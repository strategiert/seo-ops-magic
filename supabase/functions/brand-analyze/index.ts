import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { routeToModel, getGeminiEndpoint } from "../_shared/model-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalyzeRequest {
  projectId: string;
  brandProfileId: string;
}

interface BrandAnalysis {
  brand_name: string | null;
  tagline: string | null;
  mission_statement: string | null;
  brand_story: string | null;
  brand_voice: {
    tone: string[];
    personality_traits: string[];
    writing_style: {
      formality: string;
      sentence_length: string;
      vocabulary_level: string;
      use_of_jargon: string;
    };
  };
  products: Array<{
    name: string;
    description: string;
    price?: string;
    features: string[];
    category?: string;
  }>;
  services: Array<{
    name: string;
    description: string;
    pricing_model?: string;
    target_audience?: string;
  }>;
  personas: Array<{
    name: string;
    demographics: string;
    pain_points: string[];
    goals: string[];
    preferred_channels: string[];
  }>;
  brand_keywords: {
    primary: string[];
    secondary: string[];
    long_tail: string[];
  };
  visual_identity: {
    primary_color?: string;
    secondary_colors?: string[];
    logo_description?: string;
    imagery_style?: string;
  };
}

// Build analysis prompt from crawled pages
function buildAnalysisPrompt(pages: Array<{ url: string; page_type: string; title: string; content_markdown: string; meta_description: string }>): string {
  // Sort pages by relevance (homepage first, then about, etc.)
  const sortOrder: Record<string, number> = {
    homepage: 1,
    about: 2,
    service: 3,
    product: 4,
    pricing: 5,
    team: 6,
    contact: 7,
    blog: 8,
    other: 9,
  };

  const sortedPages = [...pages].sort((a, b) =>
    (sortOrder[a.page_type] || 9) - (sortOrder[b.page_type] || 9)
  );

  // Build content summary
  const pagesSummary = sortedPages.map(page => {
    const contentPreview = (page.content_markdown || "").substring(0, 3000);
    return `
=== ${page.page_type.toUpperCase()}: ${page.title || page.url} ===
URL: ${page.url}
Meta: ${page.meta_description || "N/A"}

${contentPreview}
`;
  }).join("\n\n---\n\n");

  return `Du bist ein Brand-Analyst. Analysiere die folgenden Website-Inhalte und extrahiere alle relevanten Brand-Informationen.

WEBSITE INHALTE:
${pagesSummary}

AUFGABE:
Extrahiere folgende Informationen und gib sie als JSON zurück:

1. **brand_name**: Der offizielle Markenname
2. **tagline**: Der Slogan oder Claim (falls vorhanden)
3. **mission_statement**: Die Mission oder das Ziel des Unternehmens
4. **brand_story**: Eine kurze Zusammenfassung der Unternehmensgeschichte
5. **brand_voice**:
   - tone: Array von Adjektiven die den Ton beschreiben (z.B. "professionell", "freundlich", "innovativ")
   - personality_traits: Persönlichkeitsmerkmale der Marke
   - writing_style: Objekt mit formality, sentence_length, vocabulary_level, use_of_jargon
6. **products**: Array von Produkten mit name, description, price (falls gefunden), features, category
7. **services**: Array von Dienstleistungen mit name, description, pricing_model, target_audience
8. **personas**: Zielgruppen-Personas basierend auf dem Content (name, demographics, pain_points, goals, preferred_channels)
9. **brand_keywords**:
   - primary: Haupt-Keywords (max 5)
   - secondary: Sekundäre Keywords (max 10)
   - long_tail: Long-Tail Keywords (max 15)
10. **visual_identity**: Falls erkennbar - primary_color, secondary_colors, logo_description, imagery_style

WICHTIG:
- Antworte NUR mit validem JSON, keine Erklärungen
- Wenn etwas nicht erkennbar ist, verwende null oder leere Arrays
- Alle Texte auf Deutsch
- Sei spezifisch und konkret, keine generischen Aussagen

JSON:`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await authSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AnalyzeRequest = await req.json();
    const { projectId, brandProfileId } = body;

    if (!projectId || !brandProfileId) {
      return new Response(
        JSON.stringify({ error: "projectId and brandProfileId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, domain")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", project.workspace_id)
      .single();

    if (!workspace || workspace.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load crawled pages
    const { data: crawlData, error: crawlError } = await supabase
      .from("brand_crawl_data")
      .select("url, page_type, title, content_markdown, meta_description, relevance_score")
      .eq("brand_profile_id", brandProfileId)
      .order("relevance_score", { ascending: false })
      .limit(15); // Limit to most relevant pages

    if (crawlError) {
      throw crawlError;
    }

    if (!crawlData || crawlData.length === 0) {
      return new Response(
        JSON.stringify({ error: "No crawl data found. Please crawl the website first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`brand-analyze: Analyzing ${crawlData.length} pages for project ${projectId}`);

    // Update status to analyzing
    await supabase
      .from("brand_profiles")
      .update({ crawl_status: "analyzing" })
      .eq("id", brandProfileId);

    // Build prompt and call AI
    const prompt = buildAnalysisPrompt(crawlData);

    // Intelligentes Model-Routing: Brand-Analyse braucht gutes Reasoning
    const modelConfig = routeToModel("brand_analysis", prompt, {
      requiresStructuredOutput: true,
    });

    console.log(`brand-analyze: Using model ${modelConfig.model}`);

    const aiResponse = await fetch(getGeminiEndpoint("/chat/completions"), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${geminiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: modelConfig.temperature,
        max_tokens: modelConfig.maxTokens,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("brand-analyze: AI API error:", aiResponse.status, errorText);

      await supabase
        .from("brand_profiles")
        .update({ crawl_status: "error", crawl_error: `AI analysis failed: ${aiResponse.status}` })
        .eq("id", brandProfileId);

      return new Response(
        JSON.stringify({ error: `AI analysis failed: ${aiResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error("No content in AI response");
    }

    // Parse JSON from AI response
    let analysis: BrandAnalysis;
    try {
      // Clean up response - remove markdown code blocks if present
      let jsonStr = aiContent.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("brand-analyze: Failed to parse AI response:", aiContent);

      await supabase
        .from("brand_profiles")
        .update({ crawl_status: "error", crawl_error: "Failed to parse AI analysis" })
        .eq("id", brandProfileId);

      return new Response(
        JSON.stringify({ error: "Failed to parse AI analysis", raw: aiContent }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("brand-analyze: Successfully parsed analysis");

    // Update brand profile with analysis results
    const { error: updateError } = await supabase
      .from("brand_profiles")
      .update({
        brand_name: analysis.brand_name,
        tagline: analysis.tagline,
        mission_statement: analysis.mission_statement,
        brand_story: analysis.brand_story,
        brand_voice: analysis.brand_voice || { tone: [], personality_traits: [], writing_style: {} },
        products: analysis.products || [],
        services: analysis.services || [],
        personas: analysis.personas || [],
        brand_keywords: analysis.brand_keywords || { primary: [], secondary: [], long_tail: [] },
        visual_identity: analysis.visual_identity || {},
        crawl_status: "completed",
        crawl_error: null,
        last_analysis_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", brandProfileId);

    if (updateError) {
      throw updateError;
    }

    console.log(`brand-analyze: Analysis completed for profile ${brandProfileId}`);

    return new Response(
      JSON.stringify({
        success: true,
        brandProfileId,
        analysis: {
          brand_name: analysis.brand_name,
          products_count: analysis.products?.length || 0,
          services_count: analysis.services?.length || 0,
          personas_count: analysis.personas?.length || 0,
          keywords_count: (analysis.brand_keywords?.primary?.length || 0) +
                          (analysis.brand_keywords?.secondary?.length || 0) +
                          (analysis.brand_keywords?.long_tail?.length || 0),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("brand-analyze: Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
