// supabase/functions/_shared/sitemap-parser.ts
// Sitemap Parser - Parse and analyze sitemaps and robots.txt

import type { SitemapUrl, SitemapResult, RobotsTxtResult } from "./brand-research-types.ts";
import { detectPageType } from "./crawl-helpers.ts";

// ============================================================================
// SITEMAP PARSING
// ============================================================================

/**
 * Parses a sitemap.xml or sitemap index and returns all URLs
 */
export async function parseSitemap(url: string): Promise<SitemapResult> {
  const result: SitemapResult = {
    urls: [],
    nestedSitemaps: [],
    totalUrls: 0,
    errors: [],
  };

  try {
    // Normalize URL
    const sitemapUrl = normalizeSitemapUrl(url);
    console.log(`[SitemapParser] Fetching sitemap: ${sitemapUrl}`);

    const response = await fetch(sitemapUrl, {
      headers: {
        "User-Agent": "SEO-Ops-Magic/1.0 (Sitemap Parser)",
        "Accept": "application/xml, text/xml, */*",
      },
    });

    if (!response.ok) {
      result.errors.push(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
      return result;
    }

    const xml = await response.text();

    // Check if it's a sitemap index or a regular sitemap
    if (xml.includes("<sitemapindex")) {
      // Parse sitemap index
      const nestedUrls = extractSitemapIndexUrls(xml);
      result.nestedSitemaps = nestedUrls;

      console.log(`[SitemapParser] Found sitemap index with ${nestedUrls.length} nested sitemaps`);

      // Recursively parse nested sitemaps (limit to first 10)
      for (const nestedUrl of nestedUrls.slice(0, 10)) {
        try {
          const nestedResult = await parseSitemap(nestedUrl);
          result.urls.push(...nestedResult.urls);
          result.errors.push(...nestedResult.errors);
        } catch (err) {
          result.errors.push(`Failed to parse nested sitemap ${nestedUrl}: ${err}`);
        }
      }
    } else {
      // Parse regular sitemap
      result.urls = extractSitemapUrls(xml);
    }

    result.totalUrls = result.urls.length;
    console.log(`[SitemapParser] Parsed ${result.totalUrls} URLs total`);

  } catch (error) {
    result.errors.push(`Sitemap parsing error: ${error}`);
  }

  return result;
}

/**
 * Extracts URLs from a sitemap index XML
 */
function extractSitemapIndexUrls(xml: string): string[] {
  const urls: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/g;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url.includes("sitemap") || url.endsWith(".xml")) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * Extracts URLs from a regular sitemap XML
 */
function extractSitemapUrls(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = [];

  // Extract all <url> blocks
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];

  for (const block of urlBlocks) {
    const loc = extractTag(block, "loc");
    if (!loc) continue;

    const sitemapUrl: SitemapUrl = {
      loc,
      lastmod: extractTag(block, "lastmod") || undefined,
      changefreq: extractTag(block, "changefreq") as SitemapUrl["changefreq"],
      priority: parseFloat(extractTag(block, "priority") || "0.5") || undefined,
      pageType: detectPageType(loc),
    };

    urls.push(sitemapUrl);
  }

  return urls;
}

/**
 * Helper to extract a tag value from XML
 */
function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Normalizes a sitemap URL
 */
function normalizeSitemapUrl(url: string): string {
  // If just a domain, try common sitemap locations
  if (!url.includes("sitemap") && !url.endsWith(".xml")) {
    const base = url.endsWith("/") ? url.slice(0, -1) : url;
    return `${base}/sitemap.xml`;
  }
  return url;
}

// ============================================================================
// ROBOTS.TXT PARSING
// ============================================================================

/**
 * Parses robots.txt to find sitemaps and disallowed paths
 */
export async function parseRobotsTxt(baseUrl: string): Promise<RobotsTxtResult> {
  const result: RobotsTxtResult = {
    sitemaps: [],
    disallowed: [],
    allowed: [],
    crawlDelay: undefined,
  };

  try {
    // Normalize base URL
    const normalizedBase = baseUrl.replace(/\/$/, "");
    const robotsUrl = `${normalizedBase}/robots.txt`;

    console.log(`[SitemapParser] Fetching robots.txt: ${robotsUrl}`);

    const response = await fetch(robotsUrl, {
      headers: {
        "User-Agent": "SEO-Ops-Magic/1.0",
      },
    });

    if (!response.ok) {
      console.log(`[SitemapParser] No robots.txt found (${response.status})`);
      // Try default sitemap location
      result.sitemaps.push(`${normalizedBase}/sitemap.xml`);
      return result;
    }

    const text = await response.text();
    const lines = text.split("\n");

    let currentUserAgent = "";

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (trimmed.startsWith("#") || trimmed === "") continue;

      // Parse directives
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) continue;

      const directive = trimmed.substring(0, colonIndex).toLowerCase().trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      switch (directive) {
        case "user-agent":
          currentUserAgent = value;
          break;

        case "sitemap":
          if (!result.sitemaps.includes(value)) {
            result.sitemaps.push(value);
          }
          break;

        case "disallow":
          // Only respect rules for all bots or our bot
          if (currentUserAgent === "*" || currentUserAgent.toLowerCase().includes("seo")) {
            if (value && !result.disallowed.includes(value)) {
              result.disallowed.push(value);
            }
          }
          break;

        case "allow":
          if (currentUserAgent === "*" || currentUserAgent.toLowerCase().includes("seo")) {
            if (value && !result.allowed.includes(value)) {
              result.allowed.push(value);
            }
          }
          break;

        case "crawl-delay":
          const delay = parseInt(value, 10);
          if (!isNaN(delay) && delay > 0) {
            result.crawlDelay = delay;
          }
          break;
      }
    }

    // If no sitemap found, try default location
    if (result.sitemaps.length === 0) {
      result.sitemaps.push(`${normalizedBase}/sitemap.xml`);
    }

    console.log(`[SitemapParser] Found ${result.sitemaps.length} sitemaps, ${result.disallowed.length} disallowed paths`);

  } catch (error) {
    console.error(`[SitemapParser] robots.txt parsing error:`, error);
    // Fallback to default sitemap
    const normalizedBase = baseUrl.replace(/\/$/, "");
    result.sitemaps.push(`${normalizedBase}/sitemap.xml`);
  }

  return result;
}

// ============================================================================
// URL PRIORITIZATION
// ============================================================================

/**
 * Priority scores for different page types
 */
const PAGE_TYPE_PRIORITY: Record<string, number> = {
  homepage: 1.0,
  about: 0.95,
  product: 0.9,
  service: 0.9,
  pricing: 0.85,
  team: 0.8,
  contact: 0.75,
  faq: 0.7,
  case_study: 0.7,
  testimonial: 0.7,
  legal: 0.3,
  blog: 0.4,
  news: 0.35,
  other: 0.5,
};

/**
 * Prioritizes URLs based on page type and other factors
 */
export function prioritizeUrls(
  urls: SitemapUrl[],
  options: {
    priorityPaths?: string[];
    excludePaths?: string[];
    maxUrls?: number;
  } = {}
): SitemapUrl[] {
  const { priorityPaths = [], excludePaths = [], maxUrls = 100 } = options;

  // Filter out excluded paths
  let filtered = urls.filter((url) => {
    const path = new URL(url.loc).pathname;
    return !excludePaths.some((exclude) => {
      if (exclude.endsWith("*")) {
        return path.startsWith(exclude.slice(0, -1));
      }
      return path === exclude || path.startsWith(exclude + "/");
    });
  });

  // Score each URL
  const scored = filtered.map((url) => {
    const path = new URL(url.loc).pathname;
    let score = 0;

    // Base score from page type
    const pageType = url.pageType || detectPageType(url.loc);
    score += (PAGE_TYPE_PRIORITY[pageType] || 0.5) * 50;

    // Bonus for priority paths
    if (priorityPaths.some((p) => path.includes(p))) {
      score += 30;
    }

    // Bonus for sitemap priority
    if (url.priority) {
      score += url.priority * 10;
    }

    // Bonus for recently modified
    if (url.lastmod) {
      const age = Date.now() - new Date(url.lastmod).getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      if (daysOld < 30) score += 10;
      else if (daysOld < 90) score += 5;
    }

    // Penalty for deep paths
    const depth = path.split("/").filter(Boolean).length;
    score -= depth * 2;

    return { ...url, _score: score };
  });

  // Sort by score and limit
  scored.sort((a, b) => b._score - a._score);

  // Remove score before returning
  return scored.slice(0, maxUrls).map(({ _score, ...url }) => url);
}

/**
 * Groups URLs by page type
 */
export function groupUrlsByType(urls: SitemapUrl[]): Record<string, SitemapUrl[]> {
  const groups: Record<string, SitemapUrl[]> = {};

  for (const url of urls) {
    const pageType = url.pageType || detectPageType(url.loc);
    if (!groups[pageType]) {
      groups[pageType] = [];
    }
    groups[pageType].push(url);
  }

  return groups;
}

// ============================================================================
// DISCOVERY HELPERS
// ============================================================================

/**
 * Discovers all available sitemaps for a domain
 */
export async function discoverSitemaps(baseUrl: string): Promise<string[]> {
  const sitemaps: string[] = [];
  const normalizedBase = baseUrl.replace(/\/$/, "");

  // 1. Check robots.txt first
  const robotsResult = await parseRobotsTxt(normalizedBase);
  sitemaps.push(...robotsResult.sitemaps);

  // 2. Try common sitemap locations
  const commonLocations = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    "/sitemaps/sitemap.xml",
    "/sitemap/sitemap.xml",
  ];

  for (const loc of commonLocations) {
    const sitemapUrl = `${normalizedBase}${loc}`;
    if (!sitemaps.includes(sitemapUrl)) {
      try {
        const response = await fetch(sitemapUrl, { method: "HEAD" });
        if (response.ok) {
          sitemaps.push(sitemapUrl);
        }
      } catch {
        // Ignore errors
      }
    }
  }

  return [...new Set(sitemaps)];
}

/**
 * Full discovery: robots.txt + sitemap + prioritization
 */
export async function fullUrlDiscovery(
  websiteUrl: string,
  options: {
    maxUrls?: number;
    priorityPaths?: string[];
    excludePaths?: string[];
  } = {}
): Promise<{
  urls: SitemapUrl[];
  sitemaps: string[];
  robotsTxt: RobotsTxtResult;
  errors: string[];
}> {
  const errors: string[] = [];

  // 1. Parse robots.txt
  const robotsTxt = await parseRobotsTxt(websiteUrl);

  // 2. Parse all discovered sitemaps
  let allUrls: SitemapUrl[] = [];
  const parsedSitemaps: string[] = [];

  for (const sitemapUrl of robotsTxt.sitemaps) {
    try {
      const result = await parseSitemap(sitemapUrl);
      allUrls.push(...result.urls);
      errors.push(...result.errors);
      parsedSitemaps.push(sitemapUrl);
    } catch (err) {
      errors.push(`Failed to parse ${sitemapUrl}: ${err}`);
    }
  }

  // 3. Deduplicate URLs
  const uniqueUrls = deduplicateUrls(allUrls);

  // 4. Apply exclusions from robots.txt
  const excludePaths = [
    ...(options.excludePaths || []),
    ...robotsTxt.disallowed,
  ];

  // 5. Prioritize and limit
  const prioritizedUrls = prioritizeUrls(uniqueUrls, {
    ...options,
    excludePaths,
  });

  return {
    urls: prioritizedUrls,
    sitemaps: parsedSitemaps,
    robotsTxt,
    errors,
  };
}

/**
 * Deduplicates URLs by loc
 */
function deduplicateUrls(urls: SitemapUrl[]): SitemapUrl[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    const normalized = url.loc.toLowerCase().replace(/\/$/, "");
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}
