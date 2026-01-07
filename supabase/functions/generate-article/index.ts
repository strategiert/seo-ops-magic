import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeToModel, getGeminiEndpoint } from "../_shared/model-router.ts";
import { buildBrandContext, transformGuidelines } from "./helpers.ts";
import { scrapeUrls } from "../_shared/scrapeowl.ts";
import { enrichKeyword } from "../_shared/keyword-research.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Authentifizierung prüfen (Via User Token)
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { briefId } = await req.json();
    if (!briefId) throw new Error("briefId is required");

    // 2. Effizienter Data-Fetch (Alles in einem Join)
    const { data: brief, error: dbError } = await supabase
      .from("content_briefs")
      .select(`
        *,
        project:projects (
          id, 
          workspace:workspaces ( owner_id ),
          brand:brand_profiles (*)
        )
      `)
      .eq("id", briefId)
      .single();

    if (dbError || !brief) throw new Error("Brief not found");

    // Security Check: Gehört das Projekt dem User?
    if (brief.project?.workspace?.owner_id !== user.id) {
      throw new Error("Forbidden: You don't own this project");
    }

    // 3. Daten aufbereiten
    const guidelines = transformGuidelines(brief.nw_guidelines);
    const brandContext = buildBrandContext(brief.project.brand);
    const targetWords = brief.target_length || guidelines.targetWords;

    // === External Research (ZimmWriter Style) ===
    console.log("[Research] Starting background research...");

    // A. SERP / Keyword Research
    const keywordData = await enrichKeyword(brief.primary_keyword, supabase);
    console.log(`[Research] Keyword data found: ${!!keywordData.serp}`);

    // B. Scrape Context (Internal Links)
    // Extract raw URLs from the internal links string (simplified regex)
    // Assuming internalLinks format is "- [Anchor](URL)" or similar
    // We regex for https?://...
    const urlMatches = guidelines.internalLinks?.match(/\((https?:\/\/[^)]+)\)/g);
    const urlsToScrape = urlMatches ? urlMatches.map((u: any) => u.slice(1, -1)).slice(0, 3) : []; // Limit to 3 to save time/tokens

    console.log(`[Research] Scraping ${urlsToScrape.length} URLs...`);
    // Pass supabase client for caching
    const scrapedContent = await scrapeUrls(urlsToScrape, supabase);
    const scrapedSummary = scrapedContent
      .filter(s => !s.error && s.markdown.length > 100)
      // Limit context size per source
      .map(s => `SOURCE (${s.url}):\n${s.markdown.slice(0, 800)}...`)
      .join("\n\n");

    // 4. Prompting Setup - Verstärkter System-Prompt für JSON
    const systemPrompt = `Du bist ein Elite SEO-Texter.
WICHTIG: Deine Antwort muss ein valides JSON-Objekt sein.
- Beginne direkt mit {
- Ende mit }
- Schreibe KEINEN Text vor oder nach dem JSON.
- Keine Markdown-Codeblöcke (kein \`\`\`json).`;

    const userPrompt = `Schreibe einen Artikel basierend auf folgenden Anweisungen.
Titel: ${brief.title}
Keyword: ${brief.primary_keyword}
Ziel-Länge: ${targetWords} Wörter
Intent: ${brief.search_intent || "informational"}

### SEO & Struktur
- Das Hauptkeyword ("${brief.primary_keyword}") MUSS im H1, und in einigen H2/H3 Überschriften vorkommen.
- Nutze semantische HTML-Struktur (h1, h2, h3, p, ul, table, blockquote).
- Starte mit einer "Key Takeaways" Box (als Markdown Quote oder Liste).

### Inhalt & Stil (ZimmWriter Style)
- Nutze "Literary Devices" (Metaphern, Analogien, rhetorische Fragen), um den Text lebendig und engaging zu machen.
- Vermeide "Skinny Paragraphs" (zu kurze Absätze). Schreibe substanzielle Absätze.
- Nutze Listen und Tabellen wo immer es sinnvoll ist (für Daten, Vergleiche).
- Tone of Voice: ${brief.project.brand?.brand_voice?.tone?.join(", ") || "Professionell, aber zugänglich"}.

### Hintergrund-Recherche (Daten für besseren Kontext)
${keywordData.serp ? `Aktuelle SERP-Situation (Top Ergebnisse):
${keywordData.serp.topResults.map((r: any) => `- ${r.title}: ${r.snippet}`).join("\n")}
Nutzer fragen auch:
${keywordData.serp.peopleAlsoAsk.join(", ")}` : "(Keine Live-SERP Daten verfügbar)"}

### Referenz-Inhalte (Aus internen Links gescraped)
${scrapedSummary || "(Keine gescrapten Inhalte verfügbar - nutze dein Wissen)"}

### Interne Verlinkung
Bitte baue, wenn kontextuell passend, folgende interne Links ein:
${guidelines.internalLinks || "(Keine spezifischen Links vorhanden - nutze allgemeine Best Practices)"}

### NLP-Keywords (natürlich einbauen)
${guidelines.terms}

### Fragen (FAQ)
- ${guidelines.questions}

### Bilder / Medien
- Generiere nach jedem H2 Abschnitt einen Bild-Prompt für ein passendes Bild.
- Format: [IMAGE_PROMPT: Detaillierte Beschreibung für Midjourney]

${brandContext}

Erwarte valides JSON Format:
{
  "title": "...",
  "meta_title": "...",
  "meta_description": "...",
  "content_markdown": "# Titel\n\n> **Key Takeaways**\n> - Punkt 1\n\n...", 
  "outline": [{"level": 2, "text": "..."}],
  "faq": [{"question": "...", "answer": "..."}]
}`;

    // 5. Model Routing (Gemini 3 Pro for High Quality)
    const modelConfig = routeToModel("article_generation", userPrompt, { targetLength: targetWords });
    console.log(`[Generate] Using model: ${modelConfig.model}`);

    // 6. AI Call - OHNE response_format (nicht von Gemini unterstützt)
    const aiResponse = await fetch(getGeminiEndpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("GEMINI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.maxTokens,
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      console.error("[AI Error]", err);
      throw new Error(`AI API Error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("[AI Response Raw]", JSON.stringify(aiData).substring(0, 300) + "...");

    let content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[AI Empty] Full Response:", JSON.stringify(aiData));
      throw new Error("AI returned empty content. Check logs for details.");
    }

    // Markdown-Backticks entfernen, falls die KI sie trotz Anweisung sendet
    // Markdown-Backticks entfernen, falls die KI sie trotz Anweisung sendet
    // Wir suchen das erste '{' und das letzte '}', um robust gegen Einleitungen/Schlüsse zu sein.
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      content = content.substring(firstBrace, lastBrace + 1);
    } else {
      // Fallback: Nur Markdown Stripping probieren
      content = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    let articleData;
    try {
      articleData = JSON.parse(content);
    } catch (e) {
      console.error("[JSON Parse Failed]", content.substring(0, 200));
      console.error("[Full Content]", content); // Log full content for debug
      throw new Error("AI did not return valid JSON. Content was logged.");
    }

    // 7. Speichern
    const { data: article, error: insError } = await supabase
      .from("articles")
      .insert({
        project_id: brief.project_id,
        brief_id: briefId,
        title: articleData.title || brief.title,
        primary_keyword: brief.primary_keyword,
        content_markdown: articleData.content_markdown,
        meta_title: articleData.meta_title,
        meta_description: articleData.meta_description,
        outline_json: articleData.outline || [],
        faq_json: articleData.faq || [],
        status: "draft",
        version: 1,
      })
      .select()
      .single();

    if (insError) throw insError;

    // Status Update
    await supabase.from("content_briefs").update({ status: "completed" }).eq("id", briefId);

    return new Response(JSON.stringify({ success: true, articleId: article.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    // Log detailed error server-side only
    console.error("[Generate-Article-Error]", error instanceof Error ? error.message : error);
    // Return generic error to client
    return new Response(JSON.stringify({ error: "Failed to generate article" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
