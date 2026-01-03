import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand configuration for HTML styling
const BRAND = {
  colors: {
    primary: "#003366",
    secondary: "#ff6600",
    accent: "#ff8533",
    background_light: "#f8f9fa",
    background_alt: "#e9ecef",
    text_dark: "#333333",
    text_light: "#666666",
    border: "#dee2e6",
  },
  typography: {
    heading_font: "'Antonio', sans-serif",
    body_font: "'PT Sans', sans-serif",
  },
};

interface PublishRequest {
  articleId: string;
  status?: "publish" | "draft";
  categoryIds?: number[];
  tagIds?: number[];
  useStyledHtml?: boolean;
}

interface FAQ {
  question: string;
  answer: string;
}

// Convert Markdown to styled HTML without external dependencies
function markdownToStyledHtml(
  title: string,
  markdown: string,
  faqs: FAQ[],
  metaDescription: string
): string {
  // Basic markdown to HTML conversion
  let html = markdown
    // Escape HTML first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers (must be done before other processing)
    .replace(/^### (.+)$/gm, `<h3 style="font-family: ${BRAND.typography.heading_font}; color: ${BRAND.colors.primary}; font-size: 1.3rem; font-weight: 700; margin: 2rem 0 1rem 0; padding-bottom: 0.5rem; border-bottom: 2px solid ${BRAND.colors.secondary};">$1</h3>`)
    .replace(/^## (.+)$/gm, `<h2 style="font-family: ${BRAND.typography.heading_font}; color: ${BRAND.colors.primary}; font-size: 1.6rem; font-weight: 700; margin: 2.5rem 0 1.2rem 0; padding-bottom: 0.5rem; border-bottom: 3px solid ${BRAND.colors.secondary};">$1</h2>`)
    .replace(/^# (.+)$/gm, `<h1 style="font-family: ${BRAND.typography.heading_font}; color: ${BRAND.colors.primary}; font-size: 2rem; font-weight: 700; margin: 0 0 1.5rem 0; line-height: 1.2;">$1</h1>`)
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color: ${BRAND.colors.primary};">$1</strong>`)
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^\*   (.+)$/gm, `<li style="margin-bottom: 0.5rem; padding-left: 0.5rem;">$1</li>`)
    .replace(/^-   (.+)$/gm, `<li style="margin-bottom: 0.5rem; padding-left: 0.5rem;">$1</li>`)
    .replace(/^\* (.+)$/gm, `<li style="margin-bottom: 0.5rem; padding-left: 0.5rem;">$1</li>`)
    .replace(/^- (.+)$/gm, `<li style="margin-bottom: 0.5rem; padding-left: 0.5rem;">$1</li>`)
    // Horizontal rules
    .replace(/^---$/gm, `<hr style="border: none; border-top: 2px solid ${BRAND.colors.border}; margin: 2rem 0;">`)
    // Line breaks into paragraphs
    .replace(/\n\n/g, '</p><p style="font-family: ' + BRAND.typography.body_font + '; color: ' + BRAND.colors.text_dark + '; font-size: 1.1rem; line-height: 1.8; margin-bottom: 1.2rem;">')
    .replace(/\n/g, '<br>');

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/g, (match) => {
    return `<ul style="list-style-type: disc; padding-left: 2rem; margin: 1.5rem 0; font-family: ${BRAND.typography.body_font}; color: ${BRAND.colors.text_dark};">${match}</ul>`;
  });

  // Build FAQ section if FAQs exist
  let faqHtml = '';
  if (faqs && faqs.length > 0) {
    const faqItems = faqs.map(faq => `
      <details style="margin-bottom: 1rem; border: 1px solid ${BRAND.colors.border}; border-radius: 8px; overflow: hidden;">
        <summary style="padding: 1rem 1.5rem; background: ${BRAND.colors.background_light}; cursor: pointer; font-family: ${BRAND.typography.heading_font}; font-weight: 600; color: ${BRAND.colors.primary}; font-size: 1.1rem; list-style: none; display: flex; justify-content: space-between; align-items: center;">
          ${faq.question}
          <span style="color: ${BRAND.colors.secondary}; font-size: 1.5rem; transition: transform 0.3s;">+</span>
        </summary>
        <div style="padding: 1rem 1.5rem; background: white; font-family: ${BRAND.typography.body_font}; color: ${BRAND.colors.text_dark}; line-height: 1.7;">
          ${faq.answer}
        </div>
      </details>
    `).join('');

    faqHtml = `
      <div style="margin-top: 3rem; padding: 2rem; background: ${BRAND.colors.background_alt}; border-radius: 12px;">
        <h2 style="font-family: ${BRAND.typography.heading_font}; color: ${BRAND.colors.primary}; font-size: 1.8rem; font-weight: 700; margin-bottom: 1.5rem; text-align: center;">
          Häufig gestellte Fragen
        </h2>
        ${faqItems}
      </div>
    `;
  }

  // Build the complete styled HTML
  const styledHtml = `
<div style="max-width: 800px; margin: 0 auto; font-family: ${BRAND.typography.body_font}; color: ${BRAND.colors.text_dark};">
  <!-- Hero Section -->
  <div style="background: linear-gradient(135deg, ${BRAND.colors.primary} 0%, #004080 100%); color: white; padding: 2.5rem; border-radius: 12px; margin-bottom: 2rem; text-align: center;">
    <h1 style="font-family: ${BRAND.typography.heading_font}; font-size: 2rem; font-weight: 700; margin: 0 0 1rem 0; color: white; line-height: 1.3;">
      ${title}
    </h1>
    ${metaDescription ? `<p style="font-size: 1.1rem; opacity: 0.9; margin: 0; line-height: 1.6;">${metaDescription}</p>` : ''}
  </div>

  <!-- Main Content -->
  <div style="background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
    <p style="font-family: ${BRAND.typography.body_font}; color: ${BRAND.colors.text_dark}; font-size: 1.1rem; line-height: 1.8; margin-bottom: 1.2rem;">
      ${html}
    </p>
  </div>

  <!-- FAQ Section -->
  ${faqHtml}

  <!-- Call to Action -->
  <div style="margin-top: 2rem; padding: 2rem; background: linear-gradient(135deg, ${BRAND.colors.secondary} 0%, ${BRAND.colors.accent} 100%); border-radius: 12px; text-align: center;">
    <p style="font-family: ${BRAND.typography.heading_font}; color: white; font-size: 1.3rem; font-weight: 600; margin: 0;">
      Haben Sie Fragen? Kontaktieren Sie uns gerne!
    </p>
  </div>
</div>
  `.trim();

  return styledHtml;
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
    const { articleId, status = "draft", categoryIds = [], tagIds = [], useStyledHtml = true } = body;

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

    // Generate styled HTML if requested
    let postContent = article.content_html || article.content_markdown || "";

    if (useStyledHtml && article.content_markdown) {
      console.log("Generating styled HTML from markdown...");
      postContent = markdownToStyledHtml(
        article.title,
        article.content_markdown,
        article.faq_json || [],
        article.meta_description || ""
      );
      console.log(`Styled HTML generated: ${postContent.length} characters`);
    }

    // Prepare WordPress post data
    const wpPost = {
      title: article.title,
      content: postContent,
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
