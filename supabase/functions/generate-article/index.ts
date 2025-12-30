import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { briefId } = await req.json();
    
    if (!briefId) {
      return new Response(
        JSON.stringify({ error: "briefId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the brief with guidelines
    const { data: brief, error: briefError } = await supabase
      .from("content_briefs")
      .select("*")
      .eq("id", briefId)
      .single();

    if (briefError || !brief) {
      console.error("Brief not found:", briefError);
      return new Response(
        JSON.stringify({ error: "Brief not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the prompt
    const guidelines = brief.nw_guidelines as any;
    const nlpKeywords = guidelines?.terms?.slice(0, 30)?.map((t: any) => t.term).join(", ") || "";
    const questions = guidelines?.questions?.slice(0, 10)?.map((q: any) => q.question).join("\n- ") || "";
    const targetWords = brief.target_length || guidelines?.metrics?.avgRecommendedWords || 1500;

    const systemPrompt = `Du bist ein erfahrener SEO-Texter. Schreibe hochwertige, gut strukturierte Artikel auf Deutsch.
- Verwende das Primary Keyword natürlich im Text
- Integriere NLP-Keywords wo sinnvoll
- Strukturiere mit H2 und H3 Überschriften
- Schreibe in Markdown-Format
- Beantworte die gegebenen Fragen im Text`;

    const userPrompt = `Schreibe einen SEO-optimierten Artikel mit folgenden Vorgaben:

**Titel:** ${brief.title}
**Primary Keyword:** ${brief.primary_keyword}
**Zielgruppe:** ${brief.target_audience || "Allgemein"}
**Tonalität:** ${brief.tonality || "professionell"}
**Ziel-Wortanzahl:** ca. ${targetWords} Wörter
**Search Intent:** ${brief.search_intent || "informational"}

**NLP-Keywords zum Einbauen:** ${nlpKeywords}

**Fragen die beantwortet werden sollen:**
- ${questions}

**Zusätzliche Notizen:** ${brief.notes || "Keine"}

Erstelle den Artikel im folgenden JSON-Format:
{
  "title": "SEO-optimierter Titel",
  "meta_title": "Meta-Titel (max 60 Zeichen)",
  "meta_description": "Meta-Description (max 160 Zeichen)",
  "content_markdown": "Der vollständige Artikel in Markdown",
  "outline": [
    { "level": 2, "text": "H2 Überschrift" },
    { "level": 3, "text": "H3 Überschrift" }
  ],
  "faq": [
    { "question": "Frage?", "answer": "Antwort" }
  ]
}`;

    console.log("Calling Lovable AI for article generation...");

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedContent = aiData.choices?.[0]?.message?.content;

    if (!generatedContent) {
      console.error("No content from AI");
      return new Response(
        JSON.stringify({ error: "No content generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI response received, parsing...");

    // Parse the JSON from the response
    let articleData;
    try {
      // Extract JSON from markdown code block if present
      const jsonMatch = generatedContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                        generatedContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : generatedContent;
      articleData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      // Use raw content as fallback
      articleData = {
        title: brief.title,
        meta_title: brief.title.slice(0, 60),
        meta_description: `${brief.primary_keyword} - Erfahren Sie alles Wichtige in unserem ausführlichen Ratgeber.`,
        content_markdown: generatedContent,
        outline: [],
        faq: [],
      };
    }

    // Create the article in the database
    const { data: article, error: articleError } = await supabase
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

    if (articleError) {
      console.error("Error creating article:", articleError);
      return new Response(
        JSON.stringify({ error: "Failed to save article" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update brief status
    await supabase
      .from("content_briefs")
      .update({ status: "completed" })
      .eq("id", briefId);

    console.log("Article created successfully:", article.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        articleId: article.id,
        title: article.title 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-article:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
