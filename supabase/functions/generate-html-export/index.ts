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

// Call Claude Opus 4.5 for beautiful HTML design
async function generateBeautifulHTML(
  title: string,
  markdown: string,
  faqs: any[],
  metaDescription: string
): Promise<string> {
  const lovableGatewayUrl = Deno.env.get("LOVABLE_GATEWAY_URL");

  if (!lovableGatewayUrl) {
    throw new Error("LOVABLE_GATEWAY_URL not configured");
  }

  const designPrompt = `Du bist ein erfahrener Web-Designer mit ausgezeichnetem Geschmack für moderne, elegante Landing Pages.

**AUFGABE:** Erstelle eine wunderschöne, moderne HTML Landing Page für den folgenden Artikel.

**BRAND GUIDELINES - NetCo Body-Cam:**
- Primary Color: ${BRAND.colors.primary} (Dunkelblau)
- Secondary Color: ${BRAND.colors.secondary} (Orange)
- Accent Color: ${BRAND.colors.accent} (Hellorange)
- Headings: ${BRAND.typography.heading_font}, Bold
- Body: ${BRAND.typography.body_font}

**DESIGN ANFORDERUNGEN:**
1. Modern und professionell
2. Vollständig responsive (Mobile-First)
3. Schöne Gradient-Hintergründe für Hero und CTA
4. Sanfte Animationen beim Scrollen
5. Klare Typografie-Hierarchie
6. Ausreichend Weißraum
7. Icon-Listen mit Checkmarks
8. Accordion für FAQs (funktional mit JavaScript)
9. Sticky Navigation (optional)
10. Call-to-Action Button mit Hover-Effekt

**TECHNISCHE ANFORDERUNGEN:**
- Komplettes HTML-Dokument mit <!DOCTYPE html>
- Inline CSS im <style> Tag
- Vanilla JavaScript für Interaktivität
- Google Fonts für Antonio und PT Sans
- Font Awesome Icons (CDN)
- Keine externen Abhängigkeiten außer Fonts und Icons

**ARTIKEL TITEL:**
${title}

**META DESCRIPTION:**
${metaDescription}

**ARTIKEL INHALT (Markdown):**
${markdown.substring(0, 15000)}

**FAQs:**
${faqs.map(f => `**${f.question}**\n${f.answer}`).join('\n\n')}

**OUTPUT FORMAT:**
Gib NUR den vollständigen HTML-Code zurück. Keine Erklärungen, keine Markdown-Codeblöcke, nur pures HTML.
Das HTML sollte sofort in einem Browser funktionieren.

Erstelle eine visuell beeindruckende, professionelle Landing Page, die Besucher begeistert!`;

  console.log("Calling Claude Opus 4.5 for HTML design...");

  const response = await fetch(lovableGatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      messages: [
        {
          role: "user",
          content: designPrompt,
        },
      ],
      max_tokens: 16000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const data = await response.json();
  const html = data.content[0].text;

  console.log(`Generated HTML: ${html.length} characters`);

  return html;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleId } = await req.json();

    if (!articleId) {
      return new Response(
        JSON.stringify({ error: "articleId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    console.log("=== GENERATING HTML EXPORT ===");
    console.log("Title:", article.title);
    console.log("Markdown length:", article.content_markdown?.length || 0);
    console.log("FAQ count:", article.faq_json?.length || 0);

    // Generate beautiful HTML with Claude Opus 4.5
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
