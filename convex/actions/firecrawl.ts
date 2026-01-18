"use node";
import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

/**
 * Firecrawl Actions
 *
 * Website crawling using Firecrawl API.
 * Converted from supabase/functions/brand-crawl/index.ts
 */

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v2/crawl";

/**
 * Start a website crawl for brand research
 */
export const startCrawl = action({
  args: {
    projectId: v.id("projects"),
    websiteUrl: v.string(),
    maxPages: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, websiteUrl, maxPages = 20 }): Promise<{
    success: boolean;
    brandProfileId?: string;
    jobId?: string;
    status?: string;
    message?: string;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify project access
    const project = await ctx.runQuery(api.tables.projects.get, { id: projectId });
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // Get or create brand profile
    let brandProfile = await ctx.runQuery(api.tables.brandProfiles.getByProject, {
      projectId,
    });

    if (!brandProfile) {
      const brandProfileId = await ctx.runMutation(api.tables.brandProfiles.upsert, {
        projectId,
      });
      brandProfile = await ctx.runQuery(api.tables.brandProfiles.get, {
        id: brandProfileId,
      });
    }

    if (!brandProfile) {
      return { success: false, error: "Failed to create brand profile" };
    }

    // Format URL
    let formattedUrl = websiteUrl.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Get Firecrawl API key
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return { success: false, error: "Firecrawl API key not configured" };
    }

    // Get webhook URL (needs to be configured for your Convex deployment)
    const webhookUrl = process.env.CONVEX_SITE_URL
      ? `${process.env.CONVEX_SITE_URL}/firecrawl-webhook`
      : null;

    try {
      // Update status to crawling
      await ctx.runMutation(api.tables.brandProfiles.updateCrawlStatus, {
        id: brandProfile._id,
        crawlStatus: "crawling",
        crawlError: undefined,
      });

      // Call Firecrawl API
      const response = await fetch(FIRECRAWL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: formattedUrl,
          limit: maxPages,
          scrapeOptions: {
            formats: ["markdown"],
          },
          ...(webhookUrl && { webhook: webhookUrl }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Firecrawl error:", response.status, errorText);

        await ctx.runMutation(api.tables.brandProfiles.updateCrawlStatus, {
          id: brandProfile._id,
          crawlStatus: "error",
          crawlError: `Firecrawl error: ${response.status}`,
        });

        return {
          success: false,
          error: `Firecrawl error: ${response.status}`,
        };
      }

      const data = await response.json();

      // Update with job ID
      await ctx.runMutation(api.tables.brandProfiles.updateCrawlStatus, {
        id: brandProfile._id,
        crawlStatus: "crawling",
        crawlJobId: data.id || data.jobId,
      });

      // If no webhook, poll for results
      if (!webhookUrl && data.id) {
        // Schedule polling action
        await ctx.scheduler.runAfter(5000, internal.actions.firecrawl.pollCrawlStatus, {
          brandProfileId: brandProfile._id,
          jobId: data.id,
        });
      }

      return {
        success: true,
        brandProfileId: brandProfile._id,
        jobId: data.id || data.jobId,
        status: "crawling",
        message: "Crawl started successfully",
      };
    } catch (error) {
      console.error("Error starting crawl:", error);

      await ctx.runMutation(api.tables.brandProfiles.updateCrawlStatus, {
        id: brandProfile._id,
        crawlStatus: "error",
        crawlError: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Poll Firecrawl job status (internal action for async polling)
 */
export const pollCrawlStatus = internalAction({
  args: {
    brandProfileId: v.id("brandProfiles"),
    jobId: v.string(),
    attempts: v.optional(v.number()),
  },
  handler: async (ctx, { brandProfileId, jobId, attempts = 0 }) => {
    const maxAttempts = 60; // 5 minutes max polling

    if (attempts >= maxAttempts) {
      await ctx.runMutation(internal.tables.brandProfiles.internalUpdate, {
        id: brandProfileId,
        updates: {
          crawlStatus: "error",
          crawlError: "Crawl timeout - no response after 5 minutes",
        },
      });
      return;
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return;

    try {
      const response = await fetch(`https://api.firecrawl.dev/v2/crawl/${jobId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        // Retry later
        await ctx.scheduler.runAfter(5000, internal.actions.firecrawl.pollCrawlStatus, {
          brandProfileId,
          jobId,
          attempts: attempts + 1,
        });
        return;
      }

      const data = await response.json();

      if (data.status === "completed" && data.data) {
        // Process crawl results
        await processCrawlResults(ctx, brandProfileId, data.data);
      } else if (data.status === "failed") {
        await ctx.runMutation(internal.tables.brandProfiles.internalUpdate, {
          id: brandProfileId,
          updates: {
            crawlStatus: "error",
            crawlError: data.error || "Crawl failed",
          },
        });
      } else {
        // Still processing, poll again
        await ctx.scheduler.runAfter(5000, internal.actions.firecrawl.pollCrawlStatus, {
          brandProfileId,
          jobId,
          attempts: attempts + 1,
        });
      }
    } catch (error) {
      console.error("Error polling crawl status:", error);
      await ctx.scheduler.runAfter(10000, internal.actions.firecrawl.pollCrawlStatus, {
        brandProfileId,
        jobId,
        attempts: attempts + 1,
      });
    }
  },
});

/**
 * Process crawl results and store in database
 */
async function processCrawlResults(
  ctx: any,
  brandProfileId: any,
  pages: any[]
) {
  // Transform pages to crawl data format
  const crawlData = pages.map((page: any) => ({
    brandProfileId,
    url: page.url || page.sourceURL,
    title: page.title || page.metadata?.title,
    contentMarkdown: page.markdown || page.content,
    metaDescription: page.metadata?.description,
    pageType: detectPageType(page.url || page.sourceURL),
    headings: extractHeadings(page.markdown || page.content),
    internalLinks: page.links?.filter((l: string) =>
      l.includes(new URL(page.url || page.sourceURL).hostname)
    ),
    externalLinks: page.links?.filter(
      (l: string) => !l.includes(new URL(page.url || page.sourceURL).hostname)
    ),
    images: page.images,
    relevanceScore: calculateRelevanceScore(page),
    crawledAt: Date.now(),
  }));

  // Insert crawl data
  await ctx.runMutation(internal.tables.brandCrawlData.insertMany, {
    data: crawlData,
  });

  // Update profile status
  await ctx.runMutation(internal.tables.brandProfiles.internalUpdate, {
    id: brandProfileId,
    updates: {
      crawlStatus: "analyzing",
      lastCrawlAt: Date.now(),
    },
  });

  // Trigger analysis
  await ctx.scheduler.runAfter(0, internal.actions.gemini.analyzeBrandInternal, {
    brandProfileId,
  });
}

/**
 * Detect page type from URL
 */
function detectPageType(url: string): string {
  const path = new URL(url).pathname.toLowerCase();

  if (path === "/" || path === "") return "homepage";
  if (path.includes("about") || path.includes("ueber")) return "about";
  if (path.includes("product") || path.includes("produkt")) return "product";
  if (path.includes("service") || path.includes("leistung")) return "service";
  if (path.includes("blog") || path.includes("news") || path.includes("artikel"))
    return "blog";
  if (path.includes("contact") || path.includes("kontakt")) return "contact";
  if (path.includes("team") || path.includes("mitarbeiter")) return "team";
  if (path.includes("preis") || path.includes("price") || path.includes("pricing"))
    return "pricing";

  return "other";
}

/**
 * Extract headings from markdown content
 */
function extractHeadings(content?: string): string[] {
  if (!content) return [];

  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const matches = content.match(headingRegex);

  return matches?.map((h) => h.replace(/^#+\s+/, "")) ?? [];
}

/**
 * Calculate relevance score for a page
 */
function calculateRelevanceScore(page: any): number {
  let score = 50; // Base score

  const pageType = detectPageType(page.url || page.sourceURL);

  // Boost important page types
  const typeBoosts: Record<string, number> = {
    homepage: 30,
    about: 25,
    service: 20,
    product: 20,
    pricing: 15,
    team: 10,
    contact: 5,
    blog: 5,
    other: 0,
  };

  score += typeBoosts[pageType] ?? 0;

  // Boost pages with more content
  const contentLength = (page.markdown || page.content || "").length;
  if (contentLength > 5000) score += 10;
  else if (contentLength > 2000) score += 5;

  // Boost pages with images
  if (page.images?.length > 0) score += 5;

  return Math.min(100, score);
}
