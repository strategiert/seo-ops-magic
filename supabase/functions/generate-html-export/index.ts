import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeToModel, getGeminiEndpoint } from "../_shared/model-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Call Gemini API for beautiful HTML design for Elementor Custom HTML Widget
async function generateBeautifulHTML(
  title: string,
  markdown: string,
  faqs: any[],
  metaDescription: string
): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const designPrompt = `Du bist ein erfahrener Web-Designer mit ausgezeichnetem Geschmack für moderne, elegante Landing Pages.

**AUFGABE:** Erstelle HTML-Content für ein **Elementor Custom HTML Widget**.

**WICHTIG - ELEMENTOR CUSTOM HTML WIDGET FORMAT:**
- NUR Body-Content (keine <!DOCTYPE>, <html>, <head>, <body> Tags)
- KEINE separaten <style> oder <script> Tags
- Alle CSS-Styles müssen INLINE in den style="" Attributen sein
- Kein externes CSS oder JavaScript
- Direkter HTML-Content, der in ein Custom HTML Widget eingefügt werden kann

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
2. Vollständig responsive mit media queries in style="" Attributen
3. Schöne Gradient-Hintergründe für Hero und CTA
4. Klare Typografie-Hierarchie
5. Ausreichend Weißraum
6. Icon-Listen mit Unicode-Icons (✓, ✔, •) oder HTML-Entities
7. Einfaches Accordion für FAQs (mit <details> und <summary> Tags)
8. Call-to-Action Button mit inline hover-styles
9. Box-Shadows und Border-Radius für moderne Optik
10. Grid/Flexbox Layouts für responsive Struktur

**STRUKTUR:**
<div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
  <!-- Hero Section mit Gradient -->
  <div style="background: linear-gradient(135deg, ${BRAND.colors.primary}, #001a33); padding: 80px 20px; text-align: center; border-radius: 12px; margin-bottom: 40px;">
    <h1 style="color: white; font-family: ${BRAND.typography.heading_font}, sans-serif; font-size: 48px; margin-bottom: 20px;">${title}</h1>
  </div>

  <!-- Content Sections -->
  [Für jede H2/H3 im Markdown eine Section mit:]
  <div style="background: white/grau; padding: 60px 20px; margin-bottom: 20px; border-radius: 8px;">
    <h2 style="color: ${BRAND.colors.primary}; font-family: ${BRAND.typography.heading_font}; ...">Überschrift</h2>
    <p style="color: ${BRAND.colors.text_dark}; font-family: ${BRAND.typography.body_font}; line-height: 1.8;">Text</p>
  </div>

  <!-- FAQ Accordion mit <details> -->
  <details style="...">
    <summary style="...">Frage</summary>
    <p style="...">Antwort</p>
  </details>

  <!-- CTA Section -->
  <div style="background: linear-gradient(...); padding: 60px 20px; text-align: center; border-radius: 12px;">
    <a href="#kontakt" style="display: inline-block; background: ${BRAND.colors.secondary}; color: white; padding: 18px 40px; border-radius: 50px; ...">Jetzt anfragen</a>
  </div>
</div>

**ARTIKEL INHALT (Markdown):**
${markdown.substring(0, 15000)}

**FAQs:**
${faqs.map(f => `**${f.question}**\n${f.answer}`).join('\n\n')}

**OUTPUT FORMAT:**
Gib NUR den HTML-Content zurück, der direkt in ein Elementor Custom HTML Widget eingefügt werden kann.
- Keine Erklärungen
- Keine Markdown-Codeblöcke
- Keine <!DOCTYPE>, <html>, <head>, <body> Tags
- Nur der reine Content mit inline styles
- Beginnt direkt mit einem <div> Container

Erstelle visuell beeindruckenden Content mit perfekten inline styles!`;

  // Intelligentes Model-Routing: HTML-Design braucht Kreativität
  const modelConfig = routeToModel("html_design", designPrompt, {
    targetLength: 10000,
  });

  console.log(`Calling Gemini API (${modelConfig.model}) for HTML design...`);

  const response = await fetch(getGeminiEndpoint("/chat/completions"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [
        {
          role: "user",
          content: designPrompt,
        },
      ],
      max_tokens: 20000, // Große HTML-Seiten brauchen viele Tokens
      temperature: modelConfig.temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini API error:", response.status, error);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402) {
      throw new Error("Payment required. Please add credits to your workspace.");
    }
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  let html = data.choices?.[0]?.message?.content || "";

  // Clean up if wrapped in code blocks
  html = html
    .replace(/^```html\n?/i, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/g, "")
    .trim();

  console.log(`Generated HTML: ${html.length} characters`);

  return html;
}

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

    const { articleId } = await req.json();

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

    console.log("=== GENERATING HTML EXPORT ===");
    console.log("Title:", article.title);
    console.log("Markdown length:", article.content_markdown?.length || 0);
    console.log("FAQ count:", article.faq_json?.length || 0);

    // Generate beautiful HTML with Gemini API
    const html = await generateBeautifulHTML(
      article.title,
      article.content_markdown || '',
      article.faq_json || [],
      article.meta_description || ''
    );

    // Save HTML export
    const { data: htmlExport, error: exportError } = await supabase
      .from("html_exports")
      .insert({
        project_id: article.project_id,
        article_id: articleId,
        name: `${article.title} - HTML Export`,
        html_content: html,
      })
      .select()
      .single();

    if (exportError) {
      console.error("Error saving HTML export:", exportError);
      return new Response(
        JSON.stringify({ error: "Failed to save HTML export", details: exportError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== SUCCESS ===");
    console.log("HTML Export ID:", htmlExport.id);

    return new Response(
      JSON.stringify({
        success: true,
        exportId: htmlExport.id,
        name: htmlExport.name,
        htmlLength: html.length,
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
