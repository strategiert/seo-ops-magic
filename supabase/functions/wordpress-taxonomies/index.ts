import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaxonomyItem {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await authSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "projectId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get project and verify ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id, wp_url, workspace_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", project.workspace_id)
      .single();

    if (!workspace || workspace.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WordPress credentials
    const { data: integration } = await supabase
      .from("integrations")
      .select("*")
      .eq("project_id", projectId)
      .eq("type", "wordpress")
      .single();

    if (!integration || !integration.wp_username || !integration.wp_app_password) {
      return new Response(
        JSON.stringify({ error: "WordPress not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wpUrl = project.wp_url;
    if (!wpUrl) {
      return new Response(
        JSON.stringify({ error: "WordPress URL not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = wpUrl.replace(/\/$/, "").replace(/\/wp-json$/, "");
    const authString = btoa(`${integration.wp_username}:${integration.wp_app_password}`);

    // Fetch categories
    const categoriesResponse = await fetch(`${baseUrl}/wp-json/wp/v2/categories?per_page=100`, {
      headers: {
        "Authorization": `Basic ${authString}`,
      },
    });

    // Fetch tags
    const tagsResponse = await fetch(`${baseUrl}/wp-json/wp/v2/tags?per_page=100`, {
      headers: {
        "Authorization": `Basic ${authString}`,
      },
    });

    if (!categoriesResponse.ok || !tagsResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch taxonomies from WordPress" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const categoriesData = await categoriesResponse.json();
    const tagsData = await tagsResponse.json();

    const categories: TaxonomyItem[] = categoriesData.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: cat.count,
      parent: cat.parent || undefined,
    }));

    const tags: TaxonomyItem[] = tagsData.map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      count: tag.count,
    }));

    console.log(`Fetched ${categories.length} categories and ${tags.length} tags for project ${projectId}`);

    return new Response(
      JSON.stringify({
        categories,
        tags,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in wordpress-taxonomies:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
