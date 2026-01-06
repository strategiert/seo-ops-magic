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

    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await authSupabase.auth.getUser();

    if (userError || !user) {
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

    // Verify project ownership
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

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", project.workspace_id)
      .single();

    if (!workspace || workspace.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch WordPress integration
    const { data: integration } = await supabase
      .from("integrations")
      .select("wp_username, wp_app_password")
      .eq("project_id", project.id)
      .eq("type", "wordpress")
      .single();

    if (!integration?.wp_username || !integration?.wp_app_password) {
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

    // =========================================================================
    // GET EXISTING HTML EXPORT (nicht neu generieren!)
    // =========================================================================
    const { data: htmlExport } = await supabase
      .from("html_exports")
      .select("html_content")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 4. Content Logic
    let content = "";
    if (htmlExport?.html_content) {
      console.log("wordpress-publish: Using existing HTML export");
      const htmlContent = htmlExport.html_content;

      // Robust extraction using Linkedom
      // We look for our self-contained wrapper ID
      try {
        const { document } = parseHTML(htmlContent);
        const wrapper = document.getElementById("seo-ops-content-wrapper");

        if (wrapper) {
          // Wrap in a clean div to avoid any double-wrapping issues, 
          // but mostly just return the wrapper's outerHTML which contains 
          // inline styles and the <style> block.
          content = wrapper.outerHTML;
          console.log("wordpress-publish: Extracted content via Linkedom (#seo-ops-content-wrapper)");
        } else {
          // Fallback: Try finding the class if ID is missing (legacy exports?)
          const classWrapper = document.querySelector(".seo-ops-content");
          if (classWrapper) {
            content = classWrapper.outerHTML;
            console.log("wordpress-publish: Extracted content via Linkedom (.seo-ops-content)");
          } else {
            // Last resort fallback (e.g. if it's a raw body)
            const body = document.querySelector("body");
            content = body ? body.innerHTML : htmlContent;
            console.log("wordpress-publish: Fallback to body content");
          }
        }
      } catch (e) {
        console.error("wordpress-publish: Error parsing HTML with Linkedom", e);
        content = htmlContent; // Absolute fallback
      }

    } else if (article.content_html) {
      // Fallback to content_html field
      console.log("wordpress-publish: Using article content_html");
      content = article.content_html;
    } else if (article.content_markdown) {
      // Last resort: use markdown
      console.log("wordpress-publish: Using article content_markdown (no HTML available)");
      content = article.content_markdown;
    } else {
      return new Response(
        JSON.stringify({
          error: "No content available. Please generate HTML export first.",
          hint: "Use 'Generate HTML' button before publishing to WordPress"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("wordpress-publish: Content length:", content.length);
    console.log("wordpress-publish: Content ends with:", content.slice(-200));

    // =========================================================================
    // SEND TO WORDPRESS
    // =========================================================================
    const baseUrl = project.wp_url.replace(/\/$/, "").replace(/\/wp-json$/, "");
    const authString = btoa(`${integration.wp_username}:${integration.wp_app_password}`);
    const wpEndpoint = `${baseUrl}/wp-json/wp/v2/posts`;

    const wpPost = {
      title: article.title,
      content,
      status,
      categories: categoryIds,
      tags: tagIds,
    };

    console.log("wordpress-publish: Sending to WordPress:", {
      endpoint: wpEndpoint,
      titleLength: wpPost.title?.length,
      contentLength: wpPost.content?.length,
      status: wpPost.status,
    });

    const wpResponse = await fetch(wpEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authString}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wpPost),
    });

    const wpResponseText = await wpResponse.text();

    if (!wpResponse.ok) {
      console.error("wordpress-publish: WordPress error:", wpResponse.status, wpResponseText);
      return new Response(
        JSON.stringify({ error: `WordPress error: ${wpResponse.status}`, details: wpResponseText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let wpData;
    try {
      wpData = JSON.parse(wpResponseText);
    } catch {
      wpData = {};
    }

    console.log(`wordpress-publish: Success! wpPostId=${wpData?.id}`);

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
    console.error("wordpress-publish: Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
