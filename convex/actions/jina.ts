"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

/**
 * Jina Reader-based website crawler.
 *
 * Replaces the Firecrawl webhook/polling flow with a simpler synchronous
 * pipeline:
 *   1. Discover URLs via sitemap.xml (fallback: homepage + link graph).
 *   2. Fan out to r.jina.ai in parallel for each URL → Markdown + links.
 *   3. Write crawl rows, mark profile as analyzing, trigger Gemini.
 *
 * Jina Reader: https://jina.ai/reader/
 * Works without an API key at reduced rate limits; set JINA_API_KEY in the
 * Convex dashboard for paid quota.
 */

const JINA_READER = "https://r.jina.ai/";

interface JinaPage {
  url: string;
  title: string;
  description: string;
  content: string;
  links: string[];
  images: string[];
}

export const startCrawl = action({
  args: {
    projectId: v.id("projects"),
    websiteUrl: v.string(),
    maxPages: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { projectId, websiteUrl, maxPages = 100 }
  ): Promise<{
    success: boolean;
    brandProfileId?: string;
    pagesCrawled?: number;
    pagesFailed?: number;
    message?: string;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Unauthorized" };

    const project = await ctx.runQuery(api.tables.projects.get, { id: projectId });
    if (!project) return { success: false, error: "Project not found" };

    let brandProfile = await ctx.runQuery(api.tables.brandProfiles.getByProject, {
      projectId,
    });
    if (!brandProfile) {
      const bpId = await ctx.runMutation(api.tables.brandProfiles.upsert, {
        projectId,
      });
      brandProfile = await ctx.runQuery(api.tables.brandProfiles.get, { id: bpId });
    }
    if (!brandProfile) {
      return { success: false, error: "Failed to create brand profile" };
    }

    // Normalize URL: strip any malformed or correct protocol prefix, then
    // prepend a clean https://. Handles common typos: "https//x.de",
    // "https:/x.de", "http://x.de", "x.de", "HTTPS://x.de/".
    let baseUrl = websiteUrl.trim().replace(/^(https?:?\/*)+/i, "");
    baseUrl = `https://${baseUrl}`.replace(/\/+$/, "");

    await ctx.runMutation(api.tables.brandProfiles.updateCrawlStatus, {
      id: brandProfile._id,
      crawlStatus: "crawling",
      crawlError: undefined,
    });

    const apiKey = process.env.JINA_API_KEY;

    try {
      const urls = await discoverUrls(baseUrl, maxPages, apiKey);
      if (urls.length === 0) {
        await ctx.runMutation(api.tables.brandProfiles.updateCrawlStatus, {
          id: brandProfile._id,
          crawlStatus: "error",
          crawlError: "No URLs discovered",
        });
        return { success: false, error: "No URLs discovered" };
      }

      // Chunked parallel fetch — stay well under Jina's free-tier RPM
      // even on large (100+ URL) crawls. Adjust CHUNK to tune throughput.
      const CHUNK = 10;
      const pages: JinaPage[] = [];
      for (let i = 0; i < urls.length; i += CHUNK) {
        const batch = urls.slice(i, i + CHUNK);
        const results = await Promise.allSettled(
          batch.map((u) => jinaRead(u, apiKey))
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) pages.push(r.value);
        }
      }

      if (pages.length === 0) {
        await ctx.runMutation(api.tables.brandProfiles.updateCrawlStatus, {
          id: brandProfile._id,
          crawlStatus: "error",
          crawlError: "Jina Reader returned no usable pages",
        });
        return { success: false, error: "No pages retrieved from Jina Reader" };
      }

      const baseHost = safeHostname(baseUrl);
      const crawlData = pages.map((p) => ({
        brandProfileId: brandProfile!._id,
        url: p.url,
        title: p.title || undefined,
        contentMarkdown: p.content || undefined,
        metaDescription: p.description || undefined,
        pageType: detectPageType(p.url),
        headings: extractHeadings(p.content),
        internalLinks: p.links.filter((l) => sameDomain(safeHostname(l), baseHost)),
        externalLinks: p.links.filter((l) => !sameDomain(safeHostname(l), baseHost)),
        images: p.images,
        relevanceScore: calculateRelevanceScore(p),
        crawledAt: Date.now(),
      }));

      await ctx.runMutation(internal.tables.brandCrawlData.insertMany, {
        data: crawlData,
      });

      await ctx.runMutation(internal.tables.brandProfiles.internalUpdate, {
        id: brandProfile._id,
        updates: {
          crawlStatus: "analyzing",
          lastCrawlAt: Date.now(),
        },
      });

      await ctx.scheduler.runAfter(
        0,
        internal.actions.gemini.analyzeBrandInternal,
        { brandProfileId: brandProfile._id }
      );

      return {
        success: true,
        brandProfileId: brandProfile._id,
        pagesCrawled: pages.length,
        pagesFailed: urls.length - pages.length,
        message: `Crawled ${pages.length} of ${urls.length} pages`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(api.tables.brandProfiles.updateCrawlStatus, {
        id: brandProfile._id,
        crawlStatus: "error",
        crawlError: message,
      });
      return { success: false, error: message };
    }
  },
});

async function discoverUrls(
  baseUrl: string,
  maxPages: number,
  apiKey: string | undefined
): Promise<string[]> {
  // 1) Prefer sitemap.xml — fastest and most complete
  const sitemapUrls = await fetchSitemapUrls(baseUrl);
  if (sitemapUrls.length > 0) {
    return prioritizeUrls(sitemapUrls, baseUrl).slice(0, maxPages);
  }

  // 2) Fallback: BFS via link graph (homepage → level 1 → level 2).
  //    Stops early when maxPages worth of URLs is discovered, or when no new
  //    links show up in a pass.
  return bfsLinkCrawl(baseUrl, maxPages, apiKey);
}

async function bfsLinkCrawl(
  baseUrl: string,
  maxPages: number,
  apiKey: string | undefined,
  maxDepth = 2
): Promise<string[]> {
  const baseHost = safeHostname(baseUrl);
  const skipExt = /\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mp3|ico|css|js|xml)$/i;
  const visited = new Set<string>([baseUrl]);
  const discovered: string[] = [baseUrl];
  let frontier: string[] = [baseUrl];

  for (let depth = 0; depth < maxDepth; depth++) {
    if (discovered.length >= maxPages) break;
    if (frontier.length === 0) break;

    // Fetch current frontier in parallel (cap to avoid hammering Jina)
    const batch = frontier.slice(0, 12);
    const fetched = await Promise.allSettled(batch.map((u) => jinaRead(u, apiKey)));

    const nextFrontier: string[] = [];
    for (const r of fetched) {
      if (r.status !== "fulfilled" || !r.value) continue;
      for (const link of r.value.links) {
        if (skipExt.test(link)) continue;
        if (!sameDomain(safeHostname(link), baseHost)) continue;
        // Strip URL fragments; dedupe on normalized URL
        const clean = link.split("#")[0].replace(/\/+$/, "") || baseUrl;
        if (visited.has(clean)) continue;
        visited.add(clean);
        discovered.push(clean);
        nextFrontier.push(clean);
        if (discovered.length >= maxPages) break;
      }
      if (discovered.length >= maxPages) break;
    }
    frontier = nextFrontier;
  }

  return prioritizeUrls(discovered, baseUrl).slice(0, maxPages);
}

async function fetchSitemapUrls(baseUrl: string): Promise<string[]> {
  const candidates = [`${baseUrl}/sitemap.xml`, `${baseUrl}/sitemap_index.xml`];
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, {
        headers: { "User-Agent": "SEO-Ops-Crawler/1.0" },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      // Sitemap index? Recurse one level.
      const sitemapRefs = [...xml.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>/g)].map(
        (m) => m[1].trim()
      );
      if (sitemapRefs.length > 0) {
        const nested = await Promise.all(
          sitemapRefs.slice(0, 5).map(async (ref) => {
            try {
              const nestedRes = await fetch(ref, {
                headers: { "User-Agent": "SEO-Ops-Crawler/1.0" },
              });
              if (!nestedRes.ok) return [];
              const nestedXml = await nestedRes.text();
              return [...nestedXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
                m[1].trim()
              );
            } catch {
              return [];
            }
          })
        );
        return filterUrls(nested.flat(), baseUrl);
      }

      const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
      return filterUrls(urls, baseUrl);
    } catch {
      continue;
    }
  }
  return [];
}

function filterUrls(urls: string[], baseUrl: string): string[] {
  const baseHost = safeHostname(baseUrl);
  const skipExt = /\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mp3|ico|css|js|xml)$/i;
  return Array.from(
    new Set(
      urls.filter((u) => safeHostname(u) === baseHost && !skipExt.test(u))
    )
  );
}

function prioritizeUrls(urls: string[], baseUrl: string): string[] {
  const homepageVariants = new Set([baseUrl, `${baseUrl}/`]);
  const homepage = urls.find((u) => homepageVariants.has(u));
  const priorityRe =
    /\/(about|ueber|leistung|service|produkt|product|kontakt|contact|team|pricing|preis|unternehmen)/i;
  const priority = urls.filter((u) => priorityRe.test(u) && !homepageVariants.has(u));
  const rest = urls.filter(
    (u) => !homepageVariants.has(u) && !priority.includes(u)
  );
  const ordered = [...(homepage ? [homepage] : []), ...priority, ...rest];
  return ordered;
}

async function jinaRead(
  url: string,
  apiKey: string | undefined
): Promise<JinaPage | null> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-With-Links-Summary": "true",
    "X-With-Images-Summary": "true",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const res = await fetch(`${JINA_READER}${url}`, { headers });
    if (!res.ok) return null;

    const payload: any = await res.json();
    const d: any = payload?.data ?? payload ?? {};
    const linkMap: Record<string, string> = d.links ?? {};
    const imageMap: Record<string, string> = d.images ?? {};

    // Jina exposes `links` as {anchorText: url} and `images` as {alt: url}.
    const linkValues = Object.values(linkMap).filter(
      (v): v is string => typeof v === "string"
    );
    const imageValues = Object.values(imageMap).filter(
      (v): v is string => typeof v === "string"
    );

    return {
      url: typeof d.url === "string" ? d.url : url,
      title: typeof d.title === "string" ? d.title : "",
      description: typeof d.description === "string" ? d.description : "",
      content: typeof d.content === "string" ? d.content : "",
      links: linkValues,
      images: imageValues,
    };
  } catch {
    return null;
  }
}

function safeHostname(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
}

/**
 * Compare two hostnames ignoring a leading "www." — so links between
 * www.example.com and example.com are treated as the same domain.
 */
function sameDomain(a: string, b: string): boolean {
  const strip = (h: string) => h.replace(/^www\./i, "").toLowerCase();
  return strip(a) === strip(b);
}

function detectPageType(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path === "/" || path === "") return "homepage";
    if (path.includes("about") || path.includes("ueber")) return "about";
    if (path.includes("product") || path.includes("produkt")) return "product";
    if (path.includes("service") || path.includes("leistung")) return "service";
    if (path.includes("blog") || path.includes("news") || path.includes("artikel"))
      return "blog";
    if (path.includes("contact") || path.includes("kontakt")) return "contact";
    if (path.includes("team") || path.includes("mitarbeiter")) return "team";
    if (
      path.includes("preis") ||
      path.includes("price") ||
      path.includes("pricing")
    )
      return "pricing";
    return "other";
  } catch {
    return "other";
  }
}

function extractHeadings(content: string): string[] {
  if (!content) return [];
  const matches = content.match(/^#{1,6}\s+(.+)$/gm);
  return matches?.map((h) => h.replace(/^#+\s+/, "").trim()) ?? [];
}

function calculateRelevanceScore(page: JinaPage): number {
  let score = 50;
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
  score += typeBoosts[detectPageType(page.url)] ?? 0;

  const contentLength = page.content.length;
  if (contentLength > 5000) score += 10;
  else if (contentLength > 2000) score += 5;

  if (page.images.length > 0) score += 5;

  return Math.min(100, score);
}
