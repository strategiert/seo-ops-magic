  import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // Generate beautiful HTML using Lovable AI (same as generate-html-export)
  async function generateBeautifulHTML(
    title: string,
    markdown: string,
    faqs: any[],
    metaDescription: string
  ): Promise<string> {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

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
  ${faqs?.map(f => \`**\${f.question}**\\n\${f.answer}\`).join('\\n\\n') || 'Keine FAQs'}

  **OUTPUT FORMAT:**
  Gib NUR den HTML-Content zurück.
  - Keine Erklärungen
  - Keine Markdown-Codeblöcke
  - Beginnt direkt mit einem <div> Container`;

    console.log("wordpress-publish: Generating styled HTML with Lovable AI...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${LOVABLE_API_KEY}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content: designPrompt }],
        max_tokens: 16000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("wordpress-publish: Lovable AI error:", response.status, error);
      throw new Error(\`AI API error: \${response.status}\`);
    }

    const data = await response.json();
    let html = data.choices?.[0]?.message?.content || "";

    // Clean up code blocks if present
    html = html
      .replace(/^\`\`\`html\\n?/i, "")
      .replace(/^\`\`\`\\n?/, "")
      .replace(/\\n?\`\`\`$/g, "")
      .trim();

    console.log(\`wordpress-publish: Generated styled HTML (\${html.length} chars)\`);
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
      const authString = btoa(\`\${integration.wp_username}:\${integration.wp_app_password}\`);

      // Generate styled HTML if enabled
      let content = article.content_html || article.content_markdown || "";

      if (useStyledHtml && article.content_markdown) {
        try {
          content = await generateBeautifulHTML(
            article.title,
            article.content_markdown,
            article.faq_json || [],
            article.meta_description || ""
          );
        } catch (htmlError) {
          console.error("wordpress-publish: HTML generation failed, using raw content:", htmlError);
          // Fall back to raw markdown if AI fails
        }
      }

      const wpPost = {
        title: article.title,
        content,
        status,
        categories: categoryIds,
        tags: tagIds,
      };

      const wpEndpoint = \`\${baseUrl}/wp-json/wp/v2/posts\`;

      const wpResponse = await fetch(wpEndpoint, {
        method: "POST",
        headers: {
          Authorization: \`Basic \${authString}\`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(wpPost),
      });

      if (!wpResponse.ok) {
        const errorText = await wpResponse.text().catch(() => "");
        console.error("wordpress-publish: WordPress API error", wpResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: \`WordPress error: \${wpResponse.status}\`, details: errorText }),
          {
            status: wpResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const wpData = await wpResponse.json();

      console.log(\`wordpress-publish: published article=\${articleId} wpPostId=\${wpData?.id}\`);

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