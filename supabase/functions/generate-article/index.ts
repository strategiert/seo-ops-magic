// supabase/functions/generate-article/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeToModel, getGeminiEndpoint } from "../_shared/model-router.ts";
import { buildBrandContext, transformGuidelines } from "./helpers.ts";

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

    // 4. Prompting Setup
    const systemPrompt = `Du bist ein Elite SEO-Texter. 
ANTWORTE AUSSCHLIESSLICH IM GÜLTIGEN JSON-FORMAT.
Kein Markdown außerhalb des JSONs. Keine Einleitung.`;

    const userPrompt = `Schreibe einen Artikel basierend auf:
Titel: ${brief.title}
Keyword: ${brief.primary_keyword}
Ziel-Länge: ${targetWords} Wörter
Intent: ${brief.search_intent || "informational"}

NLP-Keywords (einbauen): ${guidelines.terms}
Zu beantwortende Fragen:
- ${guidelines.questions}

${brandContext}

Erwarte JSON Struktur:
{
  "title": "...",
  "meta_title": "...",
  "meta_description": "...",
  "content_markdown": "# Titel...", 
  "outline": [{"level": 2, "text": "..."}],
  "faq": [{"question": "...", "answer": "..."}]
}`;

    // 5. Model Routing (Gemini 3 Pro for High Quality)
    const modelConfig = routeToModel("article_generation", userPrompt, { targetLength: targetWords });
    console.log(`[Generate] Using model: ${modelConfig.model}`);

    // 6. AI Call
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
        // WICHTIG: JSON Mode erzwingen (Verhindert "No content" Fehler)
        response_format: { type: "json_object" },
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
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("AI returned empty content (Safety Filter?)");

    let articleData;
    try {
      articleData = JSON.parse(content);
    } catch (e) {
      console.error("JSON Parse failed", content.substring(0, 100));
      throw new Error("AI did not return valid JSON");
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
    console.error("[Generate-Article-Error]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
