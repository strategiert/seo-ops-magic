import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeToModel, getGeminiEndpoint } from "../_shared/model-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Build brand context for AI prompt
function buildBrandContext(brandProfile: Record<string, unknown> | null): string {
  if (!brandProfile || brandProfile.crawl_status !== "completed") {
    return "";
  }

  const sections: string[] = [];

  // Brand Identity
  if (brandProfile.brand_name) {
    sections.push(`**Marke:** ${brandProfile.brand_name}`);
  }
  if (brandProfile.tagline) {
    sections.push(`**Claim:** ${brandProfile.tagline}`);
  }

  // Brand Voice
  const brandVoice = brandProfile.brand_voice as Record<string, unknown> | null;
  if (brandVoice) {
    const tone = (brandVoice.tone as string[]) || [];
    const traits = (brandVoice.personality_traits as string[]) || [];
    const style = brandVoice.writing_style as Record<string, string> | null;

    if (tone.length > 0 || traits.length > 0) {
      let voiceSection = "**Brand Voice:**";
      if (tone.length > 0) voiceSection += `\n- Ton: ${tone.join(", ")}`;
      if (traits.length > 0) voiceSection += `\n- Persönlichkeit: ${traits.join(", ")}`;
      if (style?.formality) voiceSection += `\n- Formalität: ${style.formality}`;
      sections.push(voiceSection);
    }
  }

  // Products (only first 3 for context)
  const products = (brandProfile.products as Array<Record<string, unknown>>) || [];
  if (products.length > 0) {
    const productList = products.slice(0, 3).map(p => `- ${p.name}: ${p.description}`).join("\n");
    sections.push(`**Produkte/Services:**\n${productList}`);
  }

  // Services (only first 3 for context)
  const services = (brandProfile.services as Array<Record<string, unknown>>) || [];
  if (services.length > 0 && products.length === 0) {
    const serviceList = services.slice(0, 3).map(s => `- ${s.name}: ${s.description}`).join("\n");
    sections.push(`**Dienstleistungen:**\n${serviceList}`);
  }

  // Primary Keywords
  const keywords = brandProfile.brand_keywords as Record<string, string[]> | null;
  if (keywords?.primary && keywords.primary.length > 0) {
    sections.push(`**Brand Keywords:** ${keywords.primary.join(", ")}`);
  }

  // Target Persona (first one)
  const personas = (brandProfile.personas as Array<Record<string, unknown>>) || [];
  if (personas.length > 0) {
    const persona = personas[0];
    sections.push(`**Zielgruppe:** ${persona.name} - ${persona.demographics || "Keine Details"}`);
  }

  // Internal links for reference
  const internalLinks = (brandProfile.internal_links as Array<Record<string, string>>) || [];
  if (internalLinks.length > 0) {
    const linkList = internalLinks.slice(0, 5).map(l => `- ${l.title || l.url}`).join("\n");
    sections.push(`**Wichtige Seiten für interne Verlinkung:**\n${linkList}`);
  }

  if (sections.length === 0) {
    return "";
  }

  return `
--- BRAND KONTEXT ---
${sections.join("\n\n")}
--- ENDE BRAND KONTEXT ---

Bitte berücksichtige den Brand-Kontext beim Schreiben. Verwende die Brand Voice und integriere wo passend Verweise auf Produkte/Services. Nutze die internen Links für Verlinkungsvorschläge.
`;
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

    const { briefId } = await req.json();
    
    if (!briefId) {
      return new Response(
        JSON.stringify({ error: "briefId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Verify user owns the workspace that contains this brief's project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("workspace_id")
      .eq("id", brief.project_id)
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

    // Fetch brand profile for this project (if exists)
    const { data: brandProfile } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("project_id", brief.project_id)
      .maybeSingle();

    const brandContext = buildBrandContext(brandProfile);
    if (brandContext) {
      console.log("Brand context loaded for article generation");
    }

    // Transform guidelines if needed (handles both old DB format and new format)
    const rawGuidelines = brief.nw_guidelines as any;
    let guidelines = rawGuidelines;

    // If terms is an object (old format), transform it
    if (rawGuidelines?.terms && !Array.isArray(rawGuidelines.terms)) {
      const basicTerms = rawGuidelines.terms?.content_basic?.map((term: any) => ({
        term: term.t,
        sugg_usage: Array.isArray(term.sugg_usage) ? term.sugg_usage[1] : term.sugg_usage,
      })) || [];

      const extendedTerms = rawGuidelines.terms?.content_extended?.map((term: any) => ({
        term: term.t,
        sugg_usage: Array.isArray(term.sugg_usage) ? term.sugg_usage[1] : term.sugg_usage,
      })) || [];

      const allQuestions = [
        ...(rawGuidelines.ideas?.suggest_questions?.map((q: any) => q.q) || []),
        ...(rawGuidelines.ideas?.people_also_ask?.map((q: any) => q.q) || []),
        ...(rawGuidelines.ideas?.content_questions?.map((q: any) => q.q) || []),
      ];

      guidelines = {
        terms: [...basicTerms, ...extendedTerms],
        questions: allQuestions,
        metrics: {
          words_avg: rawGuidelines.metrics?.word_count?.target,
        },
      };
    }

    // Build the prompt
    const nlpKeywords = guidelines?.terms?.slice(0, 30)?.map((t: any) => t.term).join(", ") || "";
    const questions = guidelines?.questions?.slice(0, 10)?.join("\n- ") || "";
    const targetWords = brief.target_length || guidelines?.metrics?.words_avg || 1500;

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
${brandContext}
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

    // Intelligentes Model-Routing basierend auf Task-Komplexität
    const fullPrompt = systemPrompt + "\n\n" + userPrompt;
    const modelConfig = routeToModel("article_generation", fullPrompt, {
      targetLength: targetWords,
      requiresStructuredOutput: true,
    });

    console.log(`Calling Gemini API (${modelConfig.model}) for article generation...`);

    // Call Gemini API mit dynamisch gewähltem Model
    const aiResponse = await fetch(getGeminiEndpoint("/chat/completions"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
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
