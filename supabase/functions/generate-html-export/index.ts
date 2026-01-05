import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Call Gemini API for beautiful HTML design
async function generateBeautifulHTML(
  title: string,
  markdown: string,
  faqs: any[],
  metaDescription: string,
): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  // SETTING: GEMINI 3 PRO PREVIEW (Wie gewünscht!)
  // Wir nehmen 'pro' statt 'flash', damit er bei langen Texten nicht anfängt zu kürzen.
  const MODEL_NAME = "gemini-3-pro-preview";

  // Prompt: Explizit "DUMB CONVERTER" Modus, damit die KI nicht kreativ kürzt.
  const designPrompt = `
**ROLLE:** Du bist ein strikter Markdown-zu-HTML Compiler.
**MODUS:** "NO-SUMMARIZATION MODE".

**AUFGABE:**
Konvertiere den Markdown-Text 1:1 in HTML.
Du darfst NIEMALS Text weglassen, zusammenfassen oder durch Platzhalter ersetzen.
Der Output muss den VÖLLSTÄNDIGEN Text enthalten.

**STYLING (CSS VARS):**
Nutze im Code NUR diese Variablen, keine hex-codes (spart Tokens):
- Farben: var(--c-p), var(--c-s), var(--c-t), var(--bg)
- Fonts: var(--f-h), var(--f-b)

**HTML GERÜST (Nutze exakt dieses):**
<div style="--c-p:${BRAND.colors.primary}; --c-s:${BRAND.colors.secondary}; --c-t:${BRAND.colors.text_dark}; --bg:${BRAND.colors.background_light}; --f-h:'${BRAND.typography.heading_font}',sans-serif; --f-b:'${BRAND.typography.body_font}',sans-serif; max-width:1200px; margin:0 auto;">
  
  <div style="background:linear-gradient(135deg, var(--c-p), #000); color:white; padding:80px 20px; border-radius:12px; margin-bottom:40px; text-align:center;">
     <h1 style="font-family:var(--f-h); font-size:48px; margin:0;">${title}</h1>
  </div>

  [FÜGE HIER DEN GESAMTEN INHALT EIN]

  <div style="margin-top:60px;">
    <h2 style="font-family:var(--f-h); color:var(--c-p); text-align:center;">Häufige Fragen</h2>
    ${JSON.stringify(faqs)}.forEach(faq => {
       Erstelle <details style="background:var(--bg); margin-bottom:10px; padding:15px; border-radius:8px;">...
    })
  </div>

  <div style="text-align:center; margin-top:60px; padding:40px; background:var(--bg); border-radius:12px;">
    <a href="#kontakt" style="background:var(--c-s); color:white; padding:15px 30px; text-decoration:none; border-radius:50px; font-family:var(--f-h); font-weight:bold; display:inline-block;">Jetzt anfragen</a>
  </div>

</div>

**INPUT MARKDOWN:**
${markdown}

**INPUT FAQS:**
${JSON.stringify(faqs)}

**OUTPUT:**
Nur HTML. Kein Markdown.
`;

  console.log(`Calling Gemini API (${MODEL_NAME}) - Strict Mode...`);

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        MODEL_NAME +
        ":generateContent?key=" +
        GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: designPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1, // Fast 0, damit er sich strikt an den Text hält
            maxOutputTokens: 8192,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorTxt = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorTxt}`);
    }

    const data = await response.json();
    let html = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Cleanup
    html = html
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Safety Check End Tag
    if (!html.endsWith("</div>") && !html.endsWith(">")) {
      console.warn("HTML incomplete, patching end.");
      html += "\n</div>";
    }

    return html;
  } catch (error) {
    console.error("AI Generation failed:", error);
    return `<div style="padding:20px; color:red;">Fehler: ${error instanceof Error ? error.message : String(error)}</div>`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    console.log(`Generating HTML for article: ${article.title}`);

    // 6. EXECUTE GEMINI
    const html = await generateBeautifulHTML(
      article.title,
      article.content_markdown || "",
      article.faq_json || [],
      article.meta_description || "",
    );

    // 7. Save
    const { data: htmlExport, error: exportError } = await supabase
      .from("html_exports")
      .insert({
        project_id: article.project_id,
        article_id: articleId,
        name: `${article.title} - HTML Export (Gemini 3)`,
        html_content: html,
      })
      .select()
      .single();

    if (exportError) throw exportError;

    // 8. Return
    return new Response(
      JSON.stringify({
        success: true,
        exportId: htmlExport.id,
        name: htmlExport.name,
        htmlLength: html.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in Edge Function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
