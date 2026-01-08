import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateArticle, type GenerationConfig } from "../_shared/generationLoop.ts";

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

    // 3. Extract NeuronWriter Query ID (if available)
    const nwQueryId = brief.nw_query_id || brief.nw_guidelines?.query_id;
    const nwGuidelines = brief.nw_guidelines;

    // 4. Extract Brand Voice (if available)
    const brandVoice = brief.project.brand?.brand_voice?.tone?.join(", ");

    // 5. Run Generation Loop (Section-by-Section mit Quality Control)
    console.log(`[GenerationLoop] Starting for keyword: "${brief.primary_keyword}"`);

    const generationConfig: GenerationConfig = {
      projectId: brief.project_id,
      keyword: brief.primary_keyword,
      nwQueryId,
      nwGuidelines,
      locale: "de-DE",
      brandVoice,
      supabase,
      minLocalScore: 70,
      minNwScore: 60,
      maxRetries: 2,
      requireNwValidation: !!nwQueryId, // NW Score nur wenn Query ID vorhanden
      onProgress: (progress) => {
        console.log(`[Progress] ${progress.phase}: ${progress.message}`);
      },
    };

    const result = await generateArticle(generationConfig);

    if (!result.success) {
      console.error("[GenerationLoop] Failed:", result.error);
      throw new Error(result.error || "Article generation failed");
    }

    console.log(`[GenerationLoop] Success: ${result.wordCount} words, score: ${result.finalScore}%`);

    // 6. Save Research Pack to brief
    if (result.researchPack) {
      await supabase
        .from("content_briefs")
        .update({ research_pack: result.researchPack })
        .eq("id", briefId);
    }

    // 7. Build FAQ from outline (if available)
    const faqJson = result.outline?.faqQuestions?.map(q => ({
      question: q,
      answer: "", // Will be filled from the markdown content
    })) || [];

    // 8. Build outline_json from sections
    const outlineJson = result.outline?.sections?.map(s => ({
      level: s.headingType === 'h2' ? 2 : s.headingType === 'h3' ? 3 : 1,
      text: s.headingText,
    })) || [];

    // 9. Speichern
    const { data: article, error: insError } = await supabase
      .from("articles")
      .insert({
        project_id: brief.project_id,
        brief_id: briefId,
        title: result.outline?.title || brief.title,
        primary_keyword: brief.primary_keyword,
        content_markdown: result.markdown,
        meta_title: result.outline?.metaTitle,
        meta_description: result.outline?.metaDescription,
        outline_json: outlineJson,
        faq_json: faqJson,
        status: "draft",
        version: 1,
        // Neue Quality-Felder (falls Spalten existieren)
        // quality_score: result.finalScore,
        // nw_score: result.nwScore,
      })
      .select()
      .single();

    if (insError) throw insError;

    // Status Update
    await supabase.from("content_briefs").update({ status: "completed" }).eq("id", briefId);

    console.log(`[GenerationLoop] Article saved: ${article.id}`);

    return new Response(JSON.stringify({
      success: true,
      articleId: article.id,
      wordCount: result.wordCount,
      qualityScore: result.finalScore,
      nwScore: result.nwScore,
      sectionsGenerated: result.sectionsGenerated,
      totalRetries: result.totalRetries,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[Generate-Article-Error]", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: "Failed to generate article" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
