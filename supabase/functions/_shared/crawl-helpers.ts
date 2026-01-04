/**
 * Shared helper functions for brand crawling
 */

// Detect page type from URL and content
export function detectPageType(
  url: string | undefined,
  title: string | undefined,
  _content?: string
): string {
  const lowerUrl = (url || "").toLowerCase();
  const lowerTitle = (title || "").toLowerCase();

  if (lowerUrl === "/" || (lowerUrl.endsWith("/") && lowerUrl.split("/").filter(Boolean).length <= 1)) {
    return "homepage";
  }
  if (lowerUrl.includes("/about") || lowerUrl.includes("/ueber") || lowerUrl.includes("/unternehmen") || lowerTitle.includes("über uns")) {
    return "about";
  }
  if (lowerUrl.includes("/product") || lowerUrl.includes("/produkt") || lowerUrl.includes("/shop")) {
    return "product";
  }
  if (lowerUrl.includes("/service") || lowerUrl.includes("/leistung") || lowerUrl.includes("/dienstleistung")) {
    return "service";
  }
  if (lowerUrl.includes("/blog") || lowerUrl.includes("/news") || lowerUrl.includes("/artikel")) {
    return "blog";
  }
  if (lowerUrl.includes("/contact") || lowerUrl.includes("/kontakt")) {
    return "contact";
  }
  if (lowerUrl.includes("/team") || lowerUrl.includes("/mitarbeiter")) {
    return "team";
  }
  if (lowerUrl.includes("/preis") || lowerUrl.includes("/pricing") || lowerUrl.includes("/tarif")) {
    return "pricing";
  }

  return "other";
}

// Extract headings from markdown
export function extractHeadings(markdown: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }
  }

  return headings;
}

// Extract internal and external links
export function extractLinks(
  baseUrl: string,
  links: string[]
): { internal: string[]; external: string[] } {
  const internal: string[] = [];
  const external: string[] = [];

  try {
    const baseDomain = new URL(baseUrl).hostname;

    for (const link of links || []) {
      try {
        const url = new URL(link, baseUrl);
        if (url.hostname === baseDomain) {
          internal.push(url.href);
        } else {
          external.push(url.href);
        }
      } catch {
        // Skip invalid URLs
      }
    }
  } catch {
    // Invalid base URL
  }

  return { internal: [...new Set(internal)], external: [...new Set(external)] };
}

// Calculate relevance score based on page type
export function getRelevanceScore(pageType: string): number {
  const scores: Record<string, number> = {
    homepage: 1.0,
    about: 0.9,
    product: 0.85,
    service: 0.85,
    pricing: 0.8,
    team: 0.7,
    contact: 0.6,
    blog: 0.4,
    other: 0.5,
  };
  return scores[pageType] || 0.5;
}

// Firecrawl page interface
export interface FirecrawlPage {
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: {
    sourceURL?: string;
    title?: string;
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    language?: string;
    statusCode?: number;
  };
}

// Transform pages to database rows (for bulk insert)
export function transformPagesToRows(
  pages: FirecrawlPage[],
  brandProfileId: string,
  websiteUrl: string
) {
  return pages
    .map((page) => {
      const pageUrl = page.metadata?.sourceURL;
      if (!pageUrl) return null;

      const pageType = detectPageType(pageUrl, page.metadata?.title, page.markdown);
      const headings = extractHeadings(page.markdown || "");
      const links = extractLinks(websiteUrl, page.links || []);

      return {
        brand_profile_id: brandProfileId,
        url: pageUrl,
        page_type: pageType,
        title: page.metadata?.title || null,
        content_markdown: page.markdown || null,
        meta_description: page.metadata?.description || page.metadata?.ogDescription || null,
        headings: headings,
        internal_links: links.internal.map((url) => ({ href: url })),
        external_links: links.external.map((url) => ({ href: url })),
        relevance_score: getRelevanceScore(pageType),
      };
    })
    .filter(Boolean);
}

// Transform pages to internal links for brand profile
export function transformPagesToInternalLinks(pages: FirecrawlPage[]) {
  return pages
    .filter((p) => {
      const pageType = detectPageType(p.metadata?.sourceURL, p.metadata?.title, p.markdown);
      return p.metadata?.sourceURL && pageType !== "blog";
    })
    .map((p) => ({
      url: p.metadata!.sourceURL,
      title: p.metadata?.title || p.metadata!.sourceURL,
      page_type: detectPageType(p.metadata!.sourceURL, p.metadata?.title, p.markdown),
    }))
    .slice(0, 50);
}
