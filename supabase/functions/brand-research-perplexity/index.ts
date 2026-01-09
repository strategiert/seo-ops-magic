// supabase/functions/brand-research-perplexity/index.ts
// Perplexity Research Suite - Market analysis, industry trends, brand perception

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executeMultipleResearch } from "../_shared/perplexity-client.ts";
import type {
  ResearchType,
  BrandContext,
  ResearchRequest,
  ResearchResponse,
  RESEARCH_TYPES,
} from "../_shared/brand-research-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth check
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const body: ResearchRequest = await req.json();
    const { projectId, brandProfileId, researchTypes, forceRefresh = false } = body;

    if (!projectId || !brandProfileId) {
      throw new Error("projectId and brandProfileId are required");
    }

    if (!researchTypes || researchTypes.length === 0) {
      throw new Error("At least one researchType is required");
    }

    // Validate research types
    const validTypes = [
      "market_analysis",
      "industry_trends",
      "brand_perception",
      "audience_insights",
      "content_gaps",
      "pricing_intelligence",
      "technology_stack",
    ];

    const invalidTypes = researchTypes.filter((t) => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      throw new Error(`Invalid research types: ${invalidTypes.join(", ")}`);
    }

    // Get brand profile
    const { data: profile, error: profileError } = await supabase
      .from("brand_profiles")
      .select(`
        id,
        brand_name,
        tagline,
        products,
        services,
        brand_keywords,
        competitors,
        project:projects (
          id,
          workspace:workspaces ( owner_id )
        )
      `)
      .eq("id", brandProfileId)
      .single();

    if (profileError || !profile) {
      throw new Error("Brand profile not found");
    }

    // Security check
    if (profile.project?.workspace?.owner_id !== user.id) {
      throw new Error("Forbidden: You don't own this project");
    }

    // Get website URL from crawl data or project
    const { data: crawlData } = await supabase
      .from("brand_crawl_data")
      .select("url")
      .eq("brand_profile_id", brandProfileId)
      .eq("page_type", "homepage")
      .limit(1)
      .single();

    const domain = crawlData?.url
      ? new URL(crawlData.url).hostname
      : profile.brand_name?.toLowerCase().replace(/\s+/g, "") + ".com";

    // Build brand context
    const brandContext: BrandContext = {
      brandName: profile.brand_name || domain,
      domain,
      tagline: profile.tagline,
      products: profile.products?.map((p: { name: string }) => p.name) || [],
      services: profile.services?.map((s: { name: string }) => s.name) || [],
      keywords: [
        ...(profile.brand_keywords?.primary || []),
        ...(profile.brand_keywords?.secondary || []),
      ],
      competitors: profile.competitors?.map((c: { name: string }) => c.name) || [],
      locale: "de-DE",
    };

    console.log(`[brand-research-perplexity] Starting research for ${brandContext.brandName}`);
    console.log(`[brand-research-perplexity] Types: ${researchTypes.join(", ")}`);

    // Update status
    await supabase
      .from("brand_profiles")
      .update({ research_status: "running" })
      .eq("id", brandProfileId);

    // Execute research
    const results = await executeMultipleResearch(
      researchTypes as ResearchType[],
      brandContext,
      supabase,
      { forceRefresh }
    );

    // Update brand profile with results
    const profileUpdates: Record<string, unknown> = {
      research_status: results.errors.length === researchTypes.length ? "failed" : "completed",
      last_research_at: new Date().toISOString(),
    };

    if (results.results.market_analysis) {
      profileUpdates.market_position = results.results.market_analysis;
    }
    if (results.results.industry_trends) {
      profileUpdates.industry_insights = results.results.industry_trends;
    }
    if (results.results.brand_perception) {
      profileUpdates.external_perception = results.results.brand_perception;
    }
    if (results.results.audience_insights) {
      profileUpdates.audience_insights = results.results.audience_insights;
    }
    if (results.results.content_gaps) {
      profileUpdates.content_gaps = results.results.content_gaps;
    }

    await supabase
      .from("brand_profiles")
      .update(profileUpdates)
      .eq("id", brandProfileId);

    console.log(`[brand-research-perplexity] Completed: ${results.fresh.length} fresh, ${results.cached.length} cached, ${results.errors.length} errors`);

    const response: ResearchResponse = {
      success: results.errors.length < researchTypes.length,
      results: results.results,
      cached: results.cached,
      fresh: results.fresh,
      errors: results.errors,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[brand-research-perplexity] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        results: {},
        cached: [],
        fresh: [],
        errors: [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
