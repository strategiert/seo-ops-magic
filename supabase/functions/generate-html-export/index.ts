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

  // Modell Konfiguration (Gemini 3 Flash Preview)
  const MODEL_NAME = "gemini-3-flash-preview";

  const designPrompt = `Du bist ein erfahrener Web-Designer (Level: Senior Frontend Dev).
**AUFGABE:** Generiere HTML für ein Elementor Custom HTML Widget.

**WICHTIGSTE REGEL ZUR OPTIMIERUNG:**
Nutze **CSS Custom Properties (Variablen)** im Style-Attribut des Haupt-Containers!
Definiere Farben und Fonts oben einmal und nutze unten nur 'var(--x)'. Das spart Tokens und hält den Code sauber.

**Struktur-Vorgabe (strikt einhalten):**
<div style="--c-p:${BRAND.colors.primary}; --c-s:${BRAND.colors.secondary}; --c-t:${BRAND.colors.text_dark}; --bg:${BRAND.colors.background_light}; --f-h:'${BRAND.typography.heading_font}',sans-serif; --f-b:'${BRAND.typography.body_font}',sans-serif; max-width:1200px; margin:0 auto;">
  
  <div style="background:linear-gradient(135deg, var(--c-p), #000); color:white; padding:80px 20px; border-radius:12px; margin-bottom:40px; text-align:center;">
     <h1 style="font-family:var(--f-h); font-size:48px; margin:0;">${title}</h1>
  </div>

  [HIER DEN GANZEN ARTIKEL IN HTML KONVERTIEREN]

  <div style="margin-top:60px;">
    <h2 style="font-family:var(--f-h); color:var(--c-p); text-align:center;">Häufige Fragen</h2>
    <details style="background:var(--bg); margin-bottom:10px; padding:15px; border-radius:8px; cursor:pointer;">
      <summary style="font-family:var(--f-h); font-weight:bold; color:var(--c-p);">Frage...</summary>
      <p style="font-family:var(--f-b); margin-top:10px;">Antwort...</p>
    </details>
  </div>

  <div style="text-align:center; margin-top:60px; padding:40px; background:var(--bg); border-radius:12px;">
    <a href="#kontakt" style="background:var(--c-s); color:white; padding:15px 30px; text-decoration:none; border-radius:50px; font-family:var(--f-h); font-weight:bold; display:inline-block;">Jetzt anfragen</a>
  </div>

</div>

**INPUT DATEN:**
Markdown Content: 
${markdown.substring(0, 30000)}

FAQs: 
${JSON.stringify(faqs)}

**OUTPUT ANWEISUNG:**
- Gib NUR den rohen HTML Code zurück.
- KEIN Markdown Block (\`\`\`).
- STELLE SICHER, dass du das schließende </div> am Ende generierst.
`;

  console.log(`Calling Gemini API (${MODEL_NAME}) for HTML design...`);

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
            temperature: 0.3,
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

    // Cleanup Markdown code blocks
    html = html
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // Check completeness
    if (!html.endsWith("</div>") && !html.endsWith(">")) {
      console.warn("HTML incomplete, patching end.");
      html += "\n</div>";
    }

    return html;
  } catch (error) {
    console.error("AI Generation failed:", error);
    // Fallback HTML um Frontend-Crash zu verhindern
    return `<div style="padding:20px; color:red; border:1px solid red;">Fehler beim Generieren des Designs.<br><small>${error instanceof Error ? error.message : String(error)}</small></div>`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify Authorization
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

    // 2. Auth Check
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

    // 3. Parse Request
    const { articleId } = await req.json();
    if (!articleId) {
      return new Response(JSON.stringify({ error: "articleId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Init Service Client (for Database Access)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Fetch Data
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .single();

    if (articleError) throw new Error("Article not found");

    // 6. Security Check: Workspace Ownership
    // Check if the project belongs to a workspace owned by the user
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

    // 7. Generate HTML (The Main Task)
    const html = await generateBeautifulHTML(
      article.title,
      article.content_markdown || "",
      article.faq_json || [],
      article.meta_description || "",
    );

    // 8. Save Result
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

    if (exportError) throw exportError;

    // 9. Success Response
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
