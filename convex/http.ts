import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ── Bodycam Live-Preview (proxy + draft injection) ────────────────────────────

const LIVE_SITE = "https://netco-bodycam-website-eoa.pages.dev";

function liveUrl(pageKey: string, lang: string): string {
  if (pageKey === "homepage") return `${LIVE_SITE}/${lang}/`;
  const m = pageKey.match(/^branchen-(.+)$/);
  if (m) return `${LIVE_SITE}/${lang}/branchen/${m[1]}/`;
  return `${LIVE_SITE}/${lang}/${pageKey}/`;
}

const CORS_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Frame-Options": "ALLOWALL",
  "Access-Control-Allow-Origin": "*",
};

http.route({
  path: "/bodycam-preview",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const pageKey = url.searchParams.get("pageKey");
    const lang = url.searchParams.get("lang") || "de";

    if (!pageKey) {
      return new Response("<p>Missing pageKey</p>", { status: 400, headers: CORS_HEADERS });
    }

    // 1. Draft-Inhalt aus Convex laden (kein Auth nötig für interne Query)
    const page = await ctx.runQuery(internal.tables.bodycam.getPageInternal, { pageKey, lang });
    if (!page) {
      return new Response(`<p>Seite '${pageKey}' (${lang}) nicht im CMS gefunden.</p>`, {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    let draftContent: Record<string, string> = {};
    try {
      const parsed = JSON.parse(page.contentJson);
      for (const [k, v] of Object.entries(parsed)) {
        draftContent[k] = String(v ?? "");
      }
    } catch {
      return new Response("<p>Ungültiges contentJson</p>", { status: 500, headers: CORS_HEADERS });
    }

    // 2. Veröffentlichten Inhalt aus GitHub laden
    const pat = process.env.GITHUB_PAT;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH ?? "main";
    let publishedContent: Record<string, string> = {};

    if (pat && repo) {
      try {
        const ghRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/src/content/pages/${pageKey}.json?ref=${branch}`,
          {
            headers: {
              Authorization: `Bearer ${pat}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "SEO-Ops-CMS/1.0",
            },
          }
        );
        if (ghRes.ok) {
          const data: any = await ghRes.json();
          const binaryStr = atob(data.content.replace(/\n/g, ""));
          const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
          const raw = new TextDecoder("utf-8").decode(bytes);
          const parsed = JSON.parse(raw);
          const langObj = parsed[lang] ?? parsed.de ?? {};
          for (const [k, v] of Object.entries(langObj)) {
            publishedContent[k] = String(v ?? "");
          }
        }
      } catch {
        // GitHub-Fehler → kein Replacement, zeige trotzdem die Live-Seite
      }
    }

    // 3. Live-HTML der Astro-Seite laden
    const targetUrl = liveUrl(pageKey, lang);
    let html: string;
    try {
      const res = await fetch(targetUrl);
      if (!res.ok) {
        return new Response(
          `<p>Live-Seite konnte nicht geladen werden (${res.status}): ${targetUrl}</p>`,
          { status: 502, headers: CORS_HEADERS }
        );
      }
      html = await res.text();
    } catch (err) {
      return new Response(`<p>Fetch-Fehler: ${err}</p>`, { status: 502, headers: CORS_HEADERS });
    }

    // 4. <base href> damit relative URLs auf die Live-Site zeigen
    html = html.replace(/<head([^>]*)>/, `<head$1><base href="${LIVE_SITE}">`);

    // 5. Draft-Werte in den HTML-Text injizieren
    // Nur wenn veröffentlichte Werte bekannt sind und geändert wurden
    if (Object.keys(publishedContent).length > 0) {
      for (const [key, draftVal] of Object.entries(draftContent)) {
        const pubVal = publishedContent[key];
        // Nur ersetzen wenn: Wert hat sich geändert, nicht leer, mindestens 6 Zeichen
        if (pubVal && draftVal !== pubVal && pubVal.length >= 6 && draftVal.trim()) {
          html = html.split(pubVal).join(draftVal);
        }
      }
    }

    // 6. Preview-Banner einfügen
    const dirtyBadge = page.isDirty
      ? `<span style="margin-left:auto;background:#ff6600;padding:2px 10px;border-radius:4px;font-size:11px">Unveröffentlichte Änderungen</span>`
      : `<span style="margin-left:auto;color:rgba(255,255,255,0.4);font-size:11px">Aktuell</span>`;
    const banner = `<div style="position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#003366;color:white;font-size:12px;padding:6px 16px;display:flex;align-items:center;gap:10px;font-family:system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
      <span style="opacity:0.5">Vorschau:</span>
      <span style="font-family:monospace;font-weight:600">${pageKey}</span>
      <span style="text-transform:uppercase;opacity:0.4;font-size:10px">${lang}</span>
      ${dirtyBadge}
    </div><div style="height:34px"></div>`;
    html = html.replace(/<body([^>]*)>/, `<body$1>${banner}`);

    return new Response(html, { status: 200, headers: CORS_HEADERS });
  }),
});

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
