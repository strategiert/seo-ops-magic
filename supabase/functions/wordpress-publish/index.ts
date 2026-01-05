import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeToModel, getGeminiEndpoint } from "../_shared/model-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PublishStatus = "draft" | "publish";

// Brand configuration (NetCo Body-Cam)
const BRAND = {
  colors: {
    primary: "#003366",
    secondary: "#ff6600",
    accent: "#ff8533",
    background_light: "#f8f8f8",
    background_white: "#ffffff",
    text_dark: "#333333",
  },
  typography: {
    heading_font: "Antonio",
    body_font: "PT Sans",
  },
};

// Generate beautiful HTML using Gemini API (same as generate-html-export)
async function generateBeautifulHTML(
  title: string,
  markdown: string,
  faqs: any[],
  metaDescription: string
): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  if (!GEMINI_API_KEY) {
    console.error("wordpress-publish: GEMINI_API_KEY not configured");
    throw new Error("Service configuration error");
  }

  const faqsText = faqs?.map(f => `**${f.question}**\n${f.answer}`).join('\n\n') || 'Keine FAQs';

  const designPrompt = `Du bist ein erfahrener Web-Designer mit ausgezeichnetem Geschmack für moderne, elegante Landing Pages.

**AUFGABE:** Erstelle HTML-Content für einen **WordPress Blog-Beitrag**.

**WICHTIG - WORDPRESS FORMAT:**
- NUR Body-Content (keine <!DOCTYPE>, <html>, <head>, <body> Tags)
- KEINE separaten <style> oder <script> Tags
- Alle CSS-Styles müssen INLINE in den style="" Attributen sein
- Kein externes CSS oder JavaScript
- WordPress-kompatibles HTML

**BRAND GUIDELINES - NetCo Body-Cam:**
- Primary Color: ${BRAND.colors.primary} (Dunkelblau)
- Secondary Color: ${BRAND.colors.secondary} (Orange)
- Accent Color: ${BRAND.colors.accent} (Hellorange)
- Background Light: ${BRAND.colors.background_light} (Hellgrau)
- Text: ${BRAND.colors.text_dark} (Dunkelgrau)
- Headings: ${BRAND.typography.heading_font}, Bold
- Body: ${BRAND.typography.body_font}

**DESIGN ANFORDERUNGEN:**
1. Modern und professionell mit inline styles
2. Responsive-freundlich
3. Schöne Gradient-Hintergründe für Hero und CTA
4. Klare Typografie-Hierarchie
5. Ausreichend Weißraum
6. Icon-Listen mit Unicode-Icons (✓, ✔, •)
7. FAQ Accordion mit <details> und <summary> Tags
8. Call-to-Action am Ende
9. Box-Shadows und Border-Radius für moderne Optik

**ARTIKEL TITEL:** ${title}

**META BESCHREIBUNG:** ${metaDescription}

**ARTIKEL INHALT (Markdown):**
${markdown.substring(0, 15000)}

**FAQs:**
${faqsText}

**OUTPUT FORMAT:**
Gib NUR den HTML-Content zurück.
- Keine Erklärungen
- Keine Markdown-Codeblöcke
- Beginnt direkt mit einem <div> Container`;

  // Intelligentes Model-Routing für HTML-Generierung
  // HTML braucht mehr Tokens als normale Texte (10000+ für vollständige Seiten)
  const modelConfig = routeToModel("html_design", designPrompt, {
    targetLength: 10000, // HTML braucht viele Tokens
  });

  console.log(`wordpress-publish: Generating styled HTML with ${modelConfig.model}, maxTokens: ${modelConfig.maxTokens}...`);

  const response = await fetch(getGeminiEndpoint("/chat/completions"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [{ role: "user", content: designPrompt }],
      max_tokens: 20000, // Große HTML-Seiten brauchen viele Tokens
      temperature: modelConfig.temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("wordpress-publish: Gemini API error:", response.status, errorText);
    throw new Error("Content styling failed");
  }

  const data = await response.json();

  // Debug: Log full response structure
  console.log("wordpress-publish: Gemini response:", JSON.stringify({
    finish_reason: data.choices?.[0]?.finish_reason,
    usage: data.usage,
    content_length: data.choices?.[0]?.message?.content?.length || 0,
  }));

  let html = data.choices?.[0]?.message?.content || "";

  // Check if response was truncated
  if (data.choices?.[0]?.finish_reason === "length") {
    console.warn("wordpress-publish: WARNING - Response was truncated due to token limit!");
  }

  // Clean up code blocks if present
  html = html
    .replace(/^```html\n?/i, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/g, "")
    .trim();

  console.log(`wordpress-publish: Generated styled HTML (${html.length} chars)`);
  return html;
}

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
    const useStyledHtml = body?.useStyledHtml !== false; // Default true

    if (!articleId) {
      return new Response(JSON.stringify({ error: "articleId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch article with all fields needed for HTML generation
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("id, project_id, title, content_html, content_markdown, faq_json, meta_description")
      .eq("id", articleId)
      .single();

    if (articleError || !article) {
      return new Response(JSON.stringify({ error: "Article not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Debug: Log article content status
    console.log("wordpress-publish: Article content check:", {
      hasContentHtml: !!article.content_html,
      contentHtmlLength: article.content_html?.length || 0,
      hasContentMarkdown: !!article.content_markdown,
      contentMarkdownLength: article.content_markdown?.length || 0,
      hasFaqJson: !!article.faq_json,
      faqCount: article.faq_json?.length || 0,
      useStyledHtml,
    });

    // Generate styled HTML if enabled
    let content = article.content_html || article.content_markdown || "";

    if (useStyledHtml && article.content_markdown) {
      try {
        console.log("wordpress-publish: Generating styled HTML...");
        content = await generateBeautifulHTML(
          article.title,
          article.content_markdown,
          article.faq_json || [],
          article.meta_description || ""
        );
        console.log("wordpress-publish: HTML generated successfully, length:", content.length);
      } catch (htmlError) {
        console.error("wordpress-publish: HTML generation failed:", htmlError);
        // Fall back to raw markdown if AI fails
        content = article.content_markdown || article.content_html || "";
        console.log("wordpress-publish: Using fallback content, length:", content.length);
      }
    }

    // Warn if content is empty
    if (!content || content.length === 0) {
      console.error("wordpress-publish: WARNING - Content is empty!");
      return new Response(
        JSON.stringify({ error: "Article has no content to publish" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("wordpress-publish: Final content length:", content.length);
    console.log("wordpress-publish: Content preview:", content.substring(0, 200));

    const wpPost = {
      title: article.title,
      content,
      status,
      categories: categoryIds,
      tags: tagIds,
    };

    const wpEndpoint = `${baseUrl}/wp-json/wp/v2/posts`;

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
    console.log("wordpress-publish: WordPress response status:", wpResponse.status);
    console.log("wordpress-publish: WordPress response preview:", wpResponseText.substring(0, 500));

    if (!wpResponse.ok) {
      console.error("wordpress-publish: WordPress API error", wpResponse.status, wpResponseText);
      return new Response(
        JSON.stringify({ error: `WordPress error: ${wpResponse.status}`, details: wpResponseText }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let wpData;
    try {
      wpData = JSON.parse(wpResponseText);
    } catch (e) {
      console.error("wordpress-publish: Failed to parse WordPress response");
      wpData = {};
    }

    console.log(`wordpress-publish: published article=${articleId} wpPostId=${wpData?.id}`);
    console.log("wordpress-publish: WordPress returned content length:", wpData?.content?.rendered?.length || 0);

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
