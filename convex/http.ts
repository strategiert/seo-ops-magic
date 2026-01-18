import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * HTTP Router for webhooks and external callbacks
 *
 * Handles:
 * - Firecrawl webhook for crawl results
 * - Clerk webhook for user events
 */

const http = httpRouter();

/**
 * Firecrawl webhook handler
 * Receives crawl results and processes them
 */
http.route({
  path: "/firecrawl-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      // Extract job ID and data
      const jobId = body.jobId || body.id;
      const status = body.status;
      const data = body.data || body.results;

      if (!jobId) {
        return new Response(JSON.stringify({ error: "Missing jobId" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      console.log(`Firecrawl webhook received: jobId=${jobId}, status=${status}`);

      // Find brand profile by job ID
      const brandProfiles = await ctx.runQuery(internal.tables.brandProfiles.getByJobId, {
        jobId,
      });

      if (!brandProfiles || brandProfiles.length === 0) {
        console.error("No brand profile found for job:", jobId);
        return new Response(JSON.stringify({ error: "Brand profile not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const brandProfile = brandProfiles[0];

      if (status === "completed" && data) {
        // Transform and store crawl data
        const crawlData = data.map((page: any) => ({
          brandProfileId: brandProfile._id,
          url: page.url || page.sourceURL,
          title: page.title || page.metadata?.title,
          contentMarkdown: page.markdown || page.content,
          metaDescription: page.metadata?.description,
          pageType: detectPageType(page.url || page.sourceURL),
          headings: extractHeadings(page.markdown || page.content),
          internalLinks: page.links?.filter((l: string) => {
            try {
              return l.includes(new URL(page.url || page.sourceURL).hostname);
            } catch {
              return false;
            }
          }),
          externalLinks: page.links?.filter((l: string) => {
            try {
              return !l.includes(new URL(page.url || page.sourceURL).hostname);
            } catch {
              return true;
            }
          }),
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
          id: brandProfile._id,
          updates: {
            crawlStatus: "analyzing",
            lastCrawlAt: Date.now(),
          },
        });

        // Trigger analysis
        await ctx.scheduler.runAfter(0, internal.actions.gemini.analyzeBrandInternal, {
          brandProfileId: brandProfile._id,
        });
      } else if (status === "failed") {
        await ctx.runMutation(internal.tables.brandProfiles.internalUpdate, {
          id: brandProfile._id,
          updates: {
            crawlStatus: "error",
            crawlError: body.error || "Crawl failed",
          },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Firecrawl webhook error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * Clerk webhook handler
 * Creates user profile when a new user signs up
 */
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const eventType = body.type;

      console.log(`Clerk webhook received: ${eventType}`);

      if (eventType === "user.created") {
        const user = body.data;

        await ctx.runMutation(internal.tables.profiles.createFromWebhook, {
          clerkUserId: user.id,
          email: user.email_addresses?.[0]?.email_address,
          fullName: `${user.first_name || ""} ${user.last_name || ""}`.trim() || undefined,
          avatarUrl: user.image_url,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Clerk webhook error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * Health check endpoint
 */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// Helper functions

function detectPageType(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path === "/" || path === "") return "homepage";
    if (path.includes("about") || path.includes("ueber")) return "about";
    if (path.includes("product") || path.includes("produkt")) return "product";
    if (path.includes("service") || path.includes("leistung")) return "service";
    if (path.includes("blog") || path.includes("news")) return "blog";
    if (path.includes("contact") || path.includes("kontakt")) return "contact";
    if (path.includes("team")) return "team";
    if (path.includes("preis") || path.includes("pricing")) return "pricing";
    return "other";
  } catch {
    return "other";
  }
}

function extractHeadings(content?: string): string[] {
  if (!content) return [];
  const matches = content.match(/^#{1,6}\s+(.+)$/gm);
  return matches?.map((h) => h.replace(/^#+\s+/, "")) ?? [];
}

function calculateRelevanceScore(page: any): number {
  let score = 50;
  const pageType = detectPageType(page.url || page.sourceURL);

  const boosts: Record<string, number> = {
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

  score += boosts[pageType] ?? 0;

  const contentLength = (page.markdown || page.content || "").length;
  if (contentLength > 5000) score += 10;
  else if (contentLength > 2000) score += 5;

  if (page.images?.length > 0) score += 5;

  return Math.min(100, score);
}

export default http;
