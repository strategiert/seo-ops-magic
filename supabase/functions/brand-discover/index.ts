// supabase/functions/brand-discover/index.ts
// Brand Discovery Orchestrator - Full brand intelligence pipeline

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JobTracker } from "../_shared/job-tracker.ts";
import { orchestrateCrawl } from "../_shared/crawl-orchestrator.ts";
import { executeMultipleResearch } from "../_shared/perplexity-client.ts";
import type { ResearchType, BrandContext, BrandDiscoverRequest } from "../_shared/brand-research-types.ts";

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

    const body: BrandDiscoverRequest = await req.json();
    const { projectId, websiteUrl, options = {} } = body;

    if (!projectId || !websiteUrl) {
      throw new Error("projectId and websiteUrl are required");
    }

    const {
      parseSitemap = true,
      maxPages = 50,
      runResearch = true,
      researchTypes = ["market_analysis", "industry_trends", "brand_perception", "audience_insights"],
      priorityPaths = [],
      excludePaths = [],
    } = options;

    // Get or create brand profile
    let { data: profile, error: profileError } = await supabase
      .from("brand_profiles")
      .select("id, brand_name, products, services")
      .eq("project_id", projectId)
      .single();

    if (profileError || !profile) {
      // Create brand profile if it doesn't exist
      const { data: newProfile, error: createError } = await supabase
        .from("brand_profiles")
        .insert({
          project_id: projectId,
          crawl_status: "pending",
          research_status: "pending",
        })
        .select("id")
        .single();

      if (createError) throw createError;
      profile = { id: newProfile.id, brand_name: "", products: [], services: [] };
    }

    // Calculate total steps
    const steps = [];
    if (parseSitemap) steps.push("sitemap");
    steps.push("crawl");
    if (runResearch) steps.push("research");
    steps.push("finalize");

    // Create job tracker
    const jobTracker = await JobTracker.create(
      supabase,
      profile.id,
      "full_discovery",
      { websiteUrl, maxPages, researchTypes, priorityPaths, excludePaths },
      steps.length
    );

    // Return job ID immediately (async processing)
    const response = new Response(
      JSON.stringify({
        success: true,
        jobId: jobTracker.getJobId(),
        message: "Brand discovery started",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    // Process in background (Edge Function will continue after response)
    (async () => {
      try {
        await jobTracker.start("Initializing brand discovery...");

        // Build webhook URL for Firecrawl
        const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/brand-crawl-webhook`;

        // Step 1: Crawl
        await jobTracker.updateProgress("Discovering and crawling website...", 10);

        const crawlResult = await orchestrateCrawl(
          websiteUrl,
          profile.id,
          supabase,
          {
            maxPages,
            priorityPaths,
            excludePaths,
            webhookUrl,
            useFallbackImmediately: false,
            onProgress: (step, progress) => {
              jobTracker.updateProgress(step, Math.round(progress * 0.5));
            },
          }
        );

        await jobTracker.completeStep("Website crawl initiated");

        // If Firecrawl was used (not fallback), the webhook will continue the process
        if (crawlResult.firecrawlJobId && !crawlResult.fallbackUsed) {
          // Store job context for webhook to continue
          await supabase
            .from("brand_research_jobs")
            .update({
              config: {
                websiteUrl,
                maxPages,
                researchTypes,
                priorityPaths,
                excludePaths,
                runResearch,
                firecrawlJobId: crawlResult.firecrawlJobId,
              },
            })
            .eq("id", jobTracker.getJobId());

          await jobTracker.updateProgress(
            "Firecrawl job started, waiting for webhook...",
            50
          );
          return; // Webhook will continue
        }

        // Step 2: Run Perplexity Research (if enabled and crawl used fallback)
        if (runResearch && researchTypes.length > 0) {
          await jobTracker.updateProgress("Running market research...", 60);

          // Build brand context from crawled data
          const brandContext = await buildBrandContext(supabase, profile.id, websiteUrl);

          const research = await executeMultipleResearch(
            researchTypes as ResearchType[],
            brandContext,
            supabase
          );

          // Store research summary in brand profile
          await updateBrandProfileWithResearch(supabase, profile.id, research.results);

          await jobTracker.completeStep(`Research completed: ${research.fresh.length} fresh, ${research.cached.length} cached`);
        }

        // Step 3: Finalize
        await jobTracker.updateProgress("Finalizing...", 95);

        // Update brand profile status
        await supabase
          .from("brand_profiles")
          .update({
            crawl_status: "completed",
            research_status: runResearch ? "completed" : "pending",
            last_crawl_at: new Date().toISOString(),
            last_research_at: runResearch ? new Date().toISOString() : null,
          })
          .eq("id", profile.id);

        await jobTracker.complete({
          crawlStrategy: crawlResult.strategy,
          fallbackUsed: crawlResult.fallbackUsed,
          pagesProcessed: crawlResult.result?.pagesProcessed || 0,
        });

      } catch (error) {
        console.error("[brand-discover] Error:", error);
        await jobTracker.fail(error instanceof Error ? error.message : String(error));
      }
    })();

    return response;

  } catch (error) {
    console.error("[brand-discover] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function buildBrandContext(
  supabase: ReturnType<typeof createClient>,
  brandProfileId: string,
  websiteUrl: string
): Promise<BrandContext> {
  // Get brand profile data
  const { data: profile } = await supabase
    .from("brand_profiles")
    .select("brand_name, tagline, products, services, brand_keywords")
    .eq("id", brandProfileId)
    .single();

  // Get crawled pages for additional context
  const { data: pages } = await supabase
    .from("brand_crawl_data")
    .select("content_markdown")
    .eq("brand_profile_id", brandProfileId)
    .order("relevance_score", { ascending: false })
    .limit(5);

  // Extract keywords from crawled content
  const extractedKeywords: string[] = [];
  if (pages) {
    for (const page of pages) {
      const words = page.content_markdown
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 5);
      extractedKeywords.push(...words.slice(0, 20));
    }
  }

  const domain = new URL(websiteUrl).hostname;

  return {
    brandName: profile?.brand_name || domain,
    domain,
    tagline: profile?.tagline,
    products: profile?.products?.map((p: { name: string }) => p.name) || [],
    services: profile?.services?.map((s: { name: string }) => s.name) || [],
    keywords: [
      ...(profile?.brand_keywords?.primary || []),
      ...(profile?.brand_keywords?.secondary || []),
      ...extractedKeywords.slice(0, 20),
    ].filter((k, i, arr) => arr.indexOf(k) === i),
  };
}

async function updateBrandProfileWithResearch(
  supabase: ReturnType<typeof createClient>,
  brandProfileId: string,
  results: Partial<Record<ResearchType, unknown>>
): Promise<void> {
  const updates: Record<string, unknown> = {};

  if (results.market_analysis) {
    updates.market_position = results.market_analysis;
  }

  if (results.industry_trends) {
    updates.industry_insights = results.industry_trends;
  }

  if (results.brand_perception) {
    updates.external_perception = results.brand_perception;
  }

  if (results.audience_insights) {
    updates.audience_insights = results.audience_insights;
  }

  if (results.content_gaps) {
    updates.content_gaps = results.content_gaps;
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from("brand_profiles")
      .update(updates)
      .eq("id", brandProfileId);
  }
}
