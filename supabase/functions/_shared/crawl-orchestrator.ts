// supabase/functions/_shared/crawl-orchestrator.ts
// Crawl Orchestrator - Intelligent crawl coordination with Firecrawl + ScrapeOwl fallback

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SitemapUrl, CrawlStrategy, CrawlConfig, CrawlResult } from "./brand-research-types.ts";
import { fullUrlDiscovery, prioritizeUrls } from "./sitemap-parser.ts";
import { scrapeUrls } from "./scrapeowl.ts";
import { detectPageType } from "./crawl-helpers.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v2/crawl";

// Page type priority for crawl strategy
const PAGE_TYPE_TIERS: Record<string, "primary" | "secondary" | "tertiary"> = {
  homepage: "primary",
  about: "primary",
  service: "primary",
  product: "secondary",
  pricing: "secondary",
  team: "secondary",
  contact: "secondary",
  case_study: "secondary",
  testimonial: "secondary",
  faq: "secondary",
  blog: "tertiary",
  news: "tertiary",
  legal: "tertiary",
  other: "tertiary",
};

// Default crawl configuration
const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  maxPages: 50,
  priorityPaths: ["/about", "/services", "/products", "/team", "/pricing"],
  excludePaths: ["/blog/*", "/news/*", "/tag/*", "/category/*", "/author/*"],
  respectRobotsTxt: true,
  followSitemap: true,
  jsRendering: true,
};

// ============================================================================
// CRAWL STRATEGY BUILDER
// ============================================================================

/**
 * Builds a crawl strategy from sitemap URLs
 */
export function buildCrawlStrategy(
  urls: SitemapUrl[],
  config: Partial<CrawlConfig> = {}
): CrawlStrategy {
  const mergedConfig = { ...DEFAULT_CRAWL_CONFIG, ...config };
  const { maxPages, priorityPaths, excludePaths } = mergedConfig;

  const strategy: CrawlStrategy = {
    primaryUrls: [],
    secondaryUrls: [],
    tertiaryUrls: [],
    excludedUrls: [],
    totalUrls: 0,
  };

  for (const url of urls) {
    const path = new URL(url.loc).pathname;
    const pageType = url.pageType || detectPageType(url.loc);

    // Check if excluded
    const isExcluded = excludePaths.some((exclude) => {
      if (exclude.endsWith("*")) {
        return path.startsWith(exclude.slice(0, -1));
      }
      return path === exclude || path.startsWith(exclude + "/");
    });

    if (isExcluded) {
      strategy.excludedUrls.push(url.loc);
      continue;
    }

    // Check if it's a priority path
    const isPriority = priorityPaths.some((p) => path.includes(p));

    // Determine tier
    let tier = PAGE_TYPE_TIERS[pageType] || "tertiary";

    // Upgrade to primary if it's a priority path
    if (isPriority && tier !== "primary") {
      tier = "primary";
    }

    // Add to appropriate tier
    switch (tier) {
      case "primary":
        strategy.primaryUrls.push(url.loc);
        break;
      case "secondary":
        strategy.secondaryUrls.push(url.loc);
        break;
      case "tertiary":
        strategy.tertiaryUrls.push(url.loc);
        break;
    }
  }

  // Limit URLs per tier while respecting maxPages
  const primaryLimit = Math.min(strategy.primaryUrls.length, Math.ceil(maxPages * 0.5));
  const secondaryLimit = Math.min(
    strategy.secondaryUrls.length,
    Math.ceil((maxPages - primaryLimit) * 0.7)
  );
  const tertiaryLimit = maxPages - primaryLimit - secondaryLimit;

  strategy.primaryUrls = strategy.primaryUrls.slice(0, primaryLimit);
  strategy.secondaryUrls = strategy.secondaryUrls.slice(0, secondaryLimit);
  strategy.tertiaryUrls = strategy.tertiaryUrls.slice(0, tertiaryLimit);

  strategy.totalUrls =
    strategy.primaryUrls.length +
    strategy.secondaryUrls.length +
    strategy.tertiaryUrls.length;

  console.log(
    `[CrawlOrchestrator] Strategy built: ${strategy.primaryUrls.length} primary, ` +
      `${strategy.secondaryUrls.length} secondary, ${strategy.tertiaryUrls.length} tertiary`
  );

  return strategy;
}

/**
 * Gets all URLs from strategy in priority order
 */
export function getStrategyUrls(strategy: CrawlStrategy): string[] {
  return [
    ...strategy.primaryUrls,
    ...strategy.secondaryUrls,
    ...strategy.tertiaryUrls,
  ];
}

// ============================================================================
// FIRECRAWL INTEGRATION
// ============================================================================

interface FirecrawlResponse {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Starts a Firecrawl job with webhook callback
 */
export async function startFirecrawl(
  websiteUrl: string,
  webhookUrl: string,
  options: {
    maxPages?: number;
    specificUrls?: string[];
  } = {}
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    return { success: false, error: "FIRECRAWL_API_KEY not configured" };
  }

  const { maxPages = 50, specificUrls } = options;

  console.log(`[CrawlOrchestrator] Starting Firecrawl for ${websiteUrl} (max ${maxPages} pages)`);

  try {
    const body: Record<string, unknown> = {
      url: websiteUrl,
      limit: maxPages,
      scrapeOptions: {
        formats: ["markdown"],
      },
      webhook: webhookUrl,
    };

    // If specific URLs provided, use them
    if (specificUrls && specificUrls.length > 0) {
      body.includePaths = specificUrls.map((u) => new URL(u).pathname);
    }

    const response = await fetch(FIRECRAWL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[CrawlOrchestrator] Firecrawl error:", error);
      return { success: false, error: `Firecrawl API error: ${response.status}` };
    }

    const data: FirecrawlResponse = await response.json();

    if (!data.success || !data.id) {
      return { success: false, error: data.error || "Unknown Firecrawl error" };
    }

    console.log(`[CrawlOrchestrator] Firecrawl job started: ${data.id}`);
    return { success: true, jobId: data.id };
  } catch (error) {
    console.error("[CrawlOrchestrator] Firecrawl exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Checks Firecrawl job status
 */
export async function checkFirecrawlStatus(
  jobId: string
): Promise<{ status: string; pagesProcessed?: number; error?: string }> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    return { status: "error", error: "FIRECRAWL_API_KEY not configured" };
  }

  try {
    const response = await fetch(`${FIRECRAWL_API_URL}/${jobId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return { status: "error", error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return {
      status: data.status || "unknown",
      pagesProcessed: data.completed || 0,
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// SCRAPEOWL FALLBACK
// ============================================================================

/**
 * Falls back to ScrapeOwl for specific URLs
 */
export async function crawlWithScrapeOwl(
  urls: string[],
  brandProfileId: string,
  supabase: SupabaseClient,
  options: {
    batchSize?: number;
    onProgress?: (processed: number, total: number) => void;
  } = {}
): Promise<CrawlResult> {
  const { batchSize = 5, onProgress } = options;

  console.log(`[CrawlOrchestrator] ScrapeOwl fallback for ${urls.length} URLs`);

  const result: CrawlResult = {
    success: true,
    pagesProcessed: 0,
    pagesFailed: 0,
    usedFallback: true,
    fallbackReason: "firecrawl_failed",
    errors: [],
  };

  // Process in batches
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    try {
      const scraped = await scrapeUrls(batch, supabase);

      for (const page of scraped) {
        if (page.error) {
          result.pagesFailed++;
          result.errors.push(`${page.url}: ${page.error}`);
        } else {
          result.pagesProcessed++;

          // Store in brand_crawl_data
          await storeCrawledPage(supabase, brandProfileId, page);
        }
      }
    } catch (error) {
      result.errors.push(`Batch ${i / batchSize + 1} failed: ${error}`);
    }

    // Progress callback
    if (onProgress) {
      onProgress(i + batch.length, urls.length);
    }
  }

  result.success = result.pagesProcessed > 0;
  console.log(
    `[CrawlOrchestrator] ScrapeOwl completed: ${result.pagesProcessed} success, ${result.pagesFailed} failed`
  );

  return result;
}

/**
 * Stores a crawled page in brand_crawl_data
 */
async function storeCrawledPage(
  supabase: SupabaseClient,
  brandProfileId: string,
  page: {
    url: string;
    markdown: string;
    error?: string;
  }
): Promise<void> {
  const pageType = detectPageType(page.url);

  // Extract title from markdown
  const titleMatch = page.markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : new URL(page.url).pathname;

  // Extract headings
  const headings: string[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(page.markdown)) !== null) {
    headings.push(match[2]);
  }

  await supabase.from("brand_crawl_data").upsert(
    {
      brand_profile_id: brandProfileId,
      url: page.url,
      page_type: pageType,
      title,
      content_markdown: page.markdown,
      headings,
      relevance_score: getRelevanceScore(pageType),
    },
    {
      onConflict: "brand_profile_id,url",
    }
  );
}

/**
 * Gets relevance score for a page type
 */
function getRelevanceScore(pageType: string): number {
  const scores: Record<string, number> = {
    homepage: 1.0,
    about: 0.95,
    service: 0.9,
    product: 0.9,
    pricing: 0.85,
    team: 0.8,
    contact: 0.75,
    faq: 0.7,
    case_study: 0.7,
    testimonial: 0.7,
    blog: 0.4,
    news: 0.35,
    legal: 0.3,
    other: 0.5,
  };
  return scores[pageType] || 0.5;
}

// ============================================================================
// ORCHESTRATED CRAWL
// ============================================================================

export interface OrchestratedCrawlOptions {
  maxPages?: number;
  priorityPaths?: string[];
  excludePaths?: string[];
  webhookUrl?: string;
  useFallbackImmediately?: boolean;
  onProgress?: (step: string, progress: number) => void;
}

/**
 * Full orchestrated crawl: Sitemap → Strategy → Firecrawl (or ScrapeOwl fallback)
 */
export async function orchestrateCrawl(
  websiteUrl: string,
  brandProfileId: string,
  supabase: SupabaseClient,
  options: OrchestratedCrawlOptions = {}
): Promise<{
  strategy: CrawlStrategy;
  firecrawlJobId?: string;
  fallbackUsed: boolean;
  result?: CrawlResult;
}> {
  const {
    maxPages = 50,
    priorityPaths = [],
    excludePaths = [],
    webhookUrl,
    useFallbackImmediately = false,
    onProgress,
  } = options;

  onProgress?.("Discovering URLs via sitemap...", 10);

  // 1. Discover URLs
  const discovery = await fullUrlDiscovery(websiteUrl, {
    maxUrls: maxPages * 2, // Get more than needed for strategy
    priorityPaths,
    excludePaths,
  });

  console.log(`[CrawlOrchestrator] Discovered ${discovery.urls.length} URLs`);

  // Save discovered URLs to brand profile
  await supabase
    .from("brand_profiles")
    .update({
      sitemap_urls: discovery.sitemaps,
      discovered_urls: discovery.urls.map((u) => u.loc),
    })
    .eq("id", brandProfileId);

  onProgress?.("Building crawl strategy...", 20);

  // 2. Build crawl strategy
  const strategy = buildCrawlStrategy(discovery.urls, {
    maxPages,
    priorityPaths,
    excludePaths,
  });

  // 3. Execute crawl
  if (useFallbackImmediately || !webhookUrl) {
    // Use ScrapeOwl directly
    onProgress?.("Crawling with ScrapeOwl...", 30);

    const allUrls = getStrategyUrls(strategy);
    const result = await crawlWithScrapeOwl(allUrls, brandProfileId, supabase, {
      onProgress: (processed, total) => {
        const progress = 30 + Math.round((processed / total) * 60);
        onProgress?.(`Crawling page ${processed}/${total}...`, progress);
      },
    });

    return {
      strategy,
      fallbackUsed: true,
      result,
    };
  } else {
    // Use Firecrawl with webhook
    onProgress?.("Starting Firecrawl job...", 30);

    const firecrawl = await startFirecrawl(websiteUrl, webhookUrl, {
      maxPages,
      specificUrls: strategy.primaryUrls.concat(strategy.secondaryUrls),
    });

    if (!firecrawl.success) {
      // Fallback to ScrapeOwl
      console.log("[CrawlOrchestrator] Firecrawl failed, falling back to ScrapeOwl");
      onProgress?.("Firecrawl failed, using ScrapeOwl fallback...", 35);

      const allUrls = getStrategyUrls(strategy);
      const result = await crawlWithScrapeOwl(allUrls, brandProfileId, supabase, {
        onProgress: (processed, total) => {
          const progress = 35 + Math.round((processed / total) * 55);
          onProgress?.(`Crawling page ${processed}/${total}...`, progress);
        },
      });

      return {
        strategy,
        fallbackUsed: true,
        result,
      };
    }

    // Update brand profile with crawl job ID
    await supabase
      .from("brand_profiles")
      .update({
        crawl_status: "crawling",
        crawl_job_id: firecrawl.jobId,
      })
      .eq("id", brandProfileId);

    return {
      strategy,
      firecrawlJobId: firecrawl.jobId,
      fallbackUsed: false,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { DEFAULT_CRAWL_CONFIG, PAGE_TYPE_TIERS };
