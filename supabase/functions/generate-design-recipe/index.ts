/**
 * Generate Design Recipe Edge Function
 *
 * Extracts blocks from article content and uses LLM to generate
 * layout decisions (recipe). The recipe is stored for later use
 * by the deterministic HTML renderer.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractBlocks, summarizeBlocksForLlm } from "../_shared/blockExtractor.ts";
import { generateRecipeWithLlm } from "../_shared/llmClient.ts";
import { validateRecipe, generateFallbackRecipe } from "../_shared/recipeSchema.ts";
import type { ArticleMeta } from "../_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create auth client to verify user
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await authSupabase.auth.getUser();
    if (userError || !user) {
      console.error("User authentication failed:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { articleId, force = false } = await req.json();

    if (!articleId) {
      return new Response(
        JSON.stringify({ error: "articleId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch article
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .single();

    if (articleError) {
      console.error("Article error:", articleError);
      return new Response(
        JSON.stringify({ error: "Article not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns the workspace that contains this article's project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("workspace_id")
      .eq("id", article.project_id)
      .single();

    if (projectError || !project) {
      console.error("Project not found:", projectError);
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", project.workspace_id)
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace not found:", workspaceError);
      return new Response(
        JSON.stringify({ error: "Workspace not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (workspace.owner_id !== user.id) {
      console.error("User does not own workspace");
      return new Response(
        JSON.stringify({ error: "Forbidden - not workspace owner" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== GENERATING DESIGN RECIPE ===");
    console.log("Article ID:", articleId);
    console.log("Title:", article.title);
    console.log("Force regenerate:", force);

    // Check for existing recipe
    const { data: existingRecipe } = await supabase
      .from("article_design_recipes")
      .select("*")
      .eq("article_id", articleId)
      .single();

    if (existingRecipe && !force) {
      console.log("Returning existing recipe (created:", existingRecipe.created_at, ")");
      return new Response(
        JSON.stringify({
          success: true,
          recipe: existingRecipe.recipe_json,
          provider: existingRecipe.provider,
          cached: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get article content
    const content = article.content_markdown || article.content || "";

    if (!content.trim()) {
      console.error("Article has no content");
      return new Response(
        JSON.stringify({ error: "Article has no content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract blocks from content
    console.log("Extracting blocks from content...");
    const blocks = extractBlocks(content);
    console.log(`Extracted ${blocks.length} blocks`);

    if (blocks.length === 0) {
      console.error("No blocks extracted from content");
      return new Response(
        JSON.stringify({ error: "Could not extract content blocks" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create compressed summary for LLM
    const blocksSummary = summarizeBlocksForLlm(blocks);

    // Article metadata for LLM context
    const articleMeta: ArticleMeta = {
      id: articleId,
      title: article.title,
      metaDescription: article.meta_description,
      primaryKeyword: article.primary_keyword,
    };

    let recipe;
    let provider = "fallback";

    try {
      // Call LLM to generate recipe
      console.log("Calling LLM for recipe generation...");
      const result = await generateRecipeWithLlm(articleMeta, blocksSummary);

      // Validate the result
      const validation = validateRecipe(result.json);

      if (validation.success && validation.recipe) {
        recipe = validation.recipe;
        provider = result.provider;
        console.log(`LLM recipe generated (provider: ${provider}, theme: ${recipe.theme})`);
      } else {
        console.warn("LLM output validation failed:", validation.errors?.format());
        console.log("Using fallback recipe");
        recipe = generateFallbackRecipe(articleId);
      }
    } catch (llmError) {
      console.error("LLM error:", llmError);
      console.log("Using fallback recipe due to LLM error");
      recipe = generateFallbackRecipe(articleId);
    }

    // Upsert recipe to database
    const { data: savedRecipe, error: saveError } = await supabase
      .from("article_design_recipes")
      .upsert({
        article_id: articleId,
        recipe_version: recipe.recipeVersion,
        provider,
        recipe_json: recipe,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "article_id",
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving recipe:", saveError);
      return new Response(
        JSON.stringify({ error: "Failed to save recipe", details: saveError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== SUCCESS ===");
    console.log("Recipe ID:", savedRecipe.id);
    console.log("Theme:", recipe.theme);
    console.log("Layout items:", recipe.layout.length);

    return new Response(
      JSON.stringify({
        success: true,
        recipe: recipe,
        provider,
        cached: false,
        recipeId: savedRecipe.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
