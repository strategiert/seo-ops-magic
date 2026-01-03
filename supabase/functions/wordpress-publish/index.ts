import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PublishStatus = "draft" | "publish";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user from the incoming JWT
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError || !user) {
      console.log("wordpress-publish: auth failed", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const articleId = body?.articleId as string | undefined;
    const status = (body?.status as PublishStatus | undefined) ?? "draft";
    const categoryIds = (body?.categoryIds as number[] | undefined) ?? [];
    const tagIds = (body?.tagIds as number[] | undefined) ?? [];

    if (!articleId) {
      return new Response(JSON.stringify({ error: "articleId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch article
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("id, project_id, title, content_html, content_markdown")
      .eq("id", articleId)
      .single();

    if (articleError || !article) {
      return new Response(JSON.stringify({ error: "Article not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, wp_url, workspace_id")
      .eq("id", article.project_id)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership (workspace owner)
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", project.workspace_id)
      .single();

    if (workspaceError || !workspace || workspace.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WordPress credentials
    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .select("wp_username, wp_app_password")
      .eq("project_id", project.id)
      .eq("type", "wordpress")
      .single();

    if (integrationError || !integration?.wp_username || !integration?.wp_app_password) {
      return new Response(JSON.stringify({ error: "WordPress not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!project.wp_url) {
      return new Response(JSON.stringify({ error: "WordPress URL not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = project.wp_url.replace(/\/$/, "").replace(/\/wp-json$/, "");
    const authString = btoa(`${integration.wp_username}:${integration.wp_app_password}`);

    const content = article.content_html || article.content_markdown || "";

    const wpPost = {
      title: article.title,
      content,
      status,
      categories: categoryIds,
      tags: tagIds,
    };

    const wpEndpoint = `${baseUrl}/wp-json/wp/v2/posts`;

    const wpResponse = await fetch(wpEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wpPost),
    });

    if (!wpResponse.ok) {
      const errorText = await wpResponse.text().catch(() => "");
      console.error("wordpress-publish: WordPress API error", wpResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `WordPress error: ${wpResponse.status}`, details: errorText }),
        {
          status: wpResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const wpData = await wpResponse.json();

    console.log(`wordpress-publish: published article=${articleId} wpPostId=${wpData?.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        wpPostId: wpData?.id,
        wpUrl: wpData?.link,
        status: wpData?.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("wordpress-publish: unhandled error", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
