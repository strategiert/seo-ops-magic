import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PublishRequest {
  articleId: string;
  status?: "publish" | "draft";
  categoryIds?: number[];
  tagIds?: number[];
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

    const body: PublishRequest = await req.json();
    const { articleId, status = "draft", categoryIds = [], tagIds = [] } = body;

    if (!articleId) {
      return new Response(
        JSON.stringify({ error: "articleId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch article
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*, projects!inner(id, workspace_id, wp_url)")
      .eq("id", articleId)
      .single();

    if (articleError || !article) {
      return new Response(
        JSON.stringify({ error: "Article not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify workspace ownership
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", article.projects.workspace_id)
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
      .eq("project_id", article.project_id)
      .eq("type", "wordpress")
      .single();

    if (!integration || !integration.wp_username || !integration.wp_app_password) {
      return new Response(
        JSON.stringify({ error: "WordPress not configured for this project" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wpUrl = article.projects.wp_url;
    if (!wpUrl) {
      return new Response(
        JSON.stringify({ error: "WordPress URL not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare WordPress post data
    const wpPost = {
      title: article.title,
      content: article.content_html || article.content_markdown || "",
      status: status,
      slug: generateSlug(article.title),
      categories: categoryIds,
      tags: tagIds,
      meta: {
        _yoast_wpseo_title: article.meta_title || article.title,
        _yoast_wpseo_metadesc: article.meta_description || "",
      },
    };

    // Check if article was already published (update vs create)
    const existingWpPostId = (article as any).wp_post_id;
    let wpResponse;
    let wpEndpoint;

    const baseUrl = wpUrl.replace(/\/$/, "").replace(/\/wp-json$/, "");
    const authString = btoa(`${integration.wp_username}:${integration.wp_app_password}`);

    if (existingWpPostId) {
      // Update existing post
      wpEndpoint = `${baseUrl}/wp-json/wp/v2/posts/${existingWpPostId}`;
      wpResponse = await fetch(wpEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authString}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(wpPost),
      });
    } else {
      // Create new post
      wpEndpoint = `${baseUrl}/wp-json/wp/v2/posts`;
      wpResponse = await fetch(wpEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authString}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(wpPost),
      });
    }

    if (!wpResponse.ok) {
      const errorData = await wpResponse.text();
      console.error("WordPress API error:", errorData);
      return new Response(
        JSON.stringify({ error: `WordPress error: ${wpResponse.status}`, details: errorData }),
        { status: wpResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wpData = await wpResponse.json();

    // Save wp_post_id back to article
    await supabase
      .from("articles")
      .update({
        wp_post_id: wpData.id,
        status: status === "publish" ? "published" : article.status
      })
      .eq("id", articleId);

    console.log(`Published article ${articleId} to WordPress as post ${wpData.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        wpPostId: wpData.id,
        wpUrl: wpData.link,
        status: wpData.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in wordpress-publish:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}
