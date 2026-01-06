/**
 * Generate HTML Export Edge Function
 *
 * Uses the deterministic renderer to create HTML from article content.
 * LLM decisions are stored in article_design_recipes table.
 * This function ONLY renders - it never calls LLM.
 *
 * Flow:
 * 1. Load article content
 * 2. Load design recipe (or use fallback)
 * 3. Extract blocks from content
 * 4. Render HTML body using deterministic renderer
 * 5. Wrap in complete HTML document with embedded CSS
 * 6. Save to html_exports table
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractBlocks } from "../_shared/blockExtractor.ts";
import { renderBlocksWithFallback } from "../_shared/renderer.ts";
import { generateHtmlDocument } from "../_shared/htmlDoc.ts";
import { generateFallbackRecipe, validateRecipe } from "../_shared/recipeSchema.ts";
import type { Recipe } from "../_shared/recipeSchema.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1. Auth Headers Check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 2. Validate User
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { articleId, format = "full" } = await req.json();

    if (!articleId) {
      return new Response(JSON.stringify({ error: "articleId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. DB Operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .single();

    if (articleError) throw new Error("Article not found");

    // 5. Ownership Check
    const { data: project } = await supabase
      .from("projects")
      .select("workspace_id")
      .eq("id", article.project_id)
      .single();

    if (project) {
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("owner_id")
        .eq("id", project.workspace_id)
        .single();

      if (workspace && workspace.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: "Forbidden - not workspace owner" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("=== GENERATING HTML EXPORT ===");
    console.log("Article ID:", articleId);
    console.log("Title:", article.title);
    console.log("Format:", format);

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

    // Load design recipe (or use fallback)
    let recipe: Recipe | null = null;
    let recipeSource = "fallback";

    const { data: storedRecipe } = await supabase
      .from("article_design_recipes")
      .select("recipe_json, provider")
      .eq("article_id", articleId)
      .single();

    if (storedRecipe?.recipe_json) {
      const validation = validateRecipe(storedRecipe.recipe_json);
      if (validation.success && validation.recipe) {
        recipe = validation.recipe;
        recipeSource = storedRecipe.provider || "stored";
        console.log(`Loaded recipe from DB (provider: ${recipeSource}, theme: ${recipe.theme})`);
      }
    }

    if (!recipe) {
      recipe = generateFallbackRecipe(articleId);
      recipeSource = "fallback";
      console.log(`Using fallback recipe (theme: ${recipe.theme})`);
    }

    // Render HTML body using deterministic renderer
    console.log("Rendering HTML body...");
    const bodyHtml = renderBlocksWithFallback(blocks, recipe);
    console.log(`Body HTML: ${bodyHtml.length} characters`);

    // Generate final HTML based on format
    let finalHtml: string;

    if (format === "body-only") {
      // Just the body content (for Elementor Custom HTML widget)
      finalHtml = bodyHtml;
    } else {
      // Full HTML document with CSS
      finalHtml = generateHtmlDocument({
        title: article.title,
        theme: recipe.theme,
        bodyHtml,
        metaDescription: article.meta_description,
      });
    }

    console.log(`Final HTML: ${finalHtml.length} characters`);

    // Save HTML export
    // Check for existing export for this article
    const { data: existingExport } = await supabase
      .from("html_exports")
      .select("id")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let htmlExport;
    let exportError;

    if (existingExport) {
      // Update existing export
      const result = await supabase
        .from("html_exports")
        .update({
          html_content: finalHtml,
          recipe_version: recipe.recipeVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingExport.id)
        .select()
        .single();

      htmlExport = result.data;
      exportError = result.error;
    } else {
      // Create new export
      const result = await supabase
        .from("html_exports")
        .insert({
          article_id: articleId,
          project_id: article.project_id,
          name: `${article.title} - HTML Export`,
          html_content: finalHtml,
          recipe_version: recipe.recipeVersion,
        })
        .select()
        .single();

      htmlExport = result.data;
      exportError = result.error;
    }

    if (exportError) {
      console.error("Error saving HTML export:", exportError);
      return new Response(
        JSON.stringify({ error: "Failed to save HTML export", details: exportError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== SUCCESS ===");
    console.log("HTML Export ID:", htmlExport.id);
    console.log("Recipe source:", recipeSource);
    console.log("Theme:", recipe.theme);
    console.log("Blocks rendered:", blocks.length);

    return new Response(
      JSON.stringify({
        success: true,
        exportId: htmlExport.id,
        htmlLength: finalHtml.length,
        blocksRendered: blocks.length,
        recipeSource,
        theme: recipe.theme,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
