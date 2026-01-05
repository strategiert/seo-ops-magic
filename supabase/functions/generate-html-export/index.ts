import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { marked } from "https://esm.sh/marked@4.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand configuration
const BRAND = {
  colors: {
    primary: "#003366",
    secondary: "#ff6600",
    text_dark: "#333333",
    background_light: "#f8f8f8",
  },
  typography: {
    heading: "Antonio, sans-serif",
    body: "PT Sans, sans-serif",
  },
};

// --- HELPER: Sicherer Markdown zu HTML Konverter mit Inline Styles ---
function convertMarkdownToStyledHtml(markdown: string): string {
  const renderer = new marked.Renderer();

  const styles = {
    h2: `font-family:${BRAND.typography.heading}; color:${BRAND.colors.primary}; margin-top:40px; margin-bottom:20px;`,
    h3: `font-family:${BRAND.typography.heading}; color:${BRAND.colors.primary}; margin-top:30px; margin-bottom:15px;`,
    p: `font-family:${BRAND.typography.body}; color:${BRAND.colors.text_dark}; line-height:1.6; margin-bottom:16px;`,
    li: `font-family:${BRAND.typography.body}; color:${BRAND.colors.text_dark}; line-height:1.6; margin-bottom:8px;`,
    strong: `color:${BRAND.colors.secondary}; font-weight:bold;`,
    a: `color:${BRAND.colors.secondary}; text-decoration:underline;`,
  };

  renderer.heading = (text, level) => {
    const style = level === 2 ? styles.h2 : level === 3 ? styles.h3 : styles.h2;
    return `<h${level} style="${style}">${text}</h${level}>`;
  };
  renderer.paragraph = (text) => `<p style="${styles.p}">${text}</p>`;
  renderer.listitem = (text) => `<li style="${styles.li}">${text}</li>`;
  renderer.strong = (text) => `<strong style="${styles.strong}">${text}</strong>`;
  renderer.link = (href, title, text) => `<a href="${href}" style="${styles.a}">${text}</a>`;

  return marked(markdown, { renderer });
}

// --- AI: Generiert nur den "Rahmen" (Hero, FAQ, CTA) ---
async function generatePageShell(title: string, faqs: any[]): Promise<{ hero: string; faq: string; cta: string }> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const MODEL_NAME = "gemini-3-flash-preview";

  const prompt = `
    Erstelle Design-Elemente für eine Landing Page für "NetCo Body-Cam".
    Titel: "${title}"
    FAQs: ${JSON.stringify(faqs)}
    
    Markenfarben: Primary ${BRAND.colors.primary}, Secondary ${BRAND.colors.secondary}.
    Fonts: ${BRAND.typography.heading}, ${BRAND.typography.body}.

    Gib mir ein JSON Objekt zurück mit genau 3 HTML-Strings (nutze Inline-Styles!):
    1. "hero": Ein beeindruckender Hero-Header (H1, Gradient Background, zentriert).
    2. "faq": Eine schöne FAQ Sektion mit <details> und <summary> Tags.
    3. "cta": Ein "Jetzt anfragen" Call-to-Action Bereich.

    Output Format: JSON only. { "hero": "...", "faq": "...", "cta": "..." }
  `;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini Error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("No content from Gemini");

  return JSON.parse(text);
}

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

    // 3. Get Payload
    const { articleId } = await req.json();
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

    console.log(`Processing Hybrid Gen for: ${article.title}`);

    // 6. PARALLEL PROCESSING
    // A: Konvertiere Markdown via Code (100% Sicher)
    const contentHtmlPromise = Promise.resolve(convertMarkdownToStyledHtml(article.content_markdown || ""));

    // B: Generiere Design Elemente via KI
    const shellPromise = generatePageShell(article.title, article.faq_json || []);

    const [contentHtml, shell] = await Promise.all([contentHtmlPromise, shellPromise]);

    // 7. Zusammenbauen
    const finalHtml = `
      <div style="max-width:1200px; margin:0 auto; font-family:'PT Sans', sans-serif;">
        ${shell.hero}
        
        <div style="padding: 40px 20px; background: #ffffff;">
          ${contentHtml}
        </div>

        ${shell.faq}
        ${shell.cta}
      </div>
    `;

    // 8. Speichern
    const { data: exportData, error: saveError } = await supabase
      .from("html_exports")
      .insert({
        project_id: article.project_id,
        article_id: articleId,
        name: `${article.title} - Hybrid Gen`,
        html_content: finalHtml,
      })
      .select()
      .single();

    if (saveError) throw saveError;

    return new Response(
      JSON.stringify({
        success: true,
        exportId: exportData.id,
        htmlLength: finalHtml.length,
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
