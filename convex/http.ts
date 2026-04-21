import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ── Bodycam Live-Preview (proxy + draft injection) ────────────────────────────

const LIVE_SITE = "https://netco-bodycam-website.pages.dev";

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

// ── Webhook signature verification helpers ────────────────────────────────────

/**
 * Verify a Svix-signed webhook payload (used by Clerk).
 * Returns true if any v1 signature in the svix-signature header matches.
 * Fails closed if headers are missing or secret is malformed.
 */
async function verifySvixSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!svixId || !svixTimestamp || !svixSignatureHeader) return false;

  const secretPart = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let secretBytes: Uint8Array;
  try {
    const bin = atob(secretPart);
    secretBytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const payload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const enc = new TextEncoder().encode(payload);

  for (const entry of svixSignatureHeader.split(" ")) {
    const [version, encoded] = entry.split(",");
    if (version !== "v1" || !encoded) continue;
    try {
      const bin = atob(encoded);
      const sigBytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const ok = await crypto.subtle.verify("HMAC", key, sigBytes, enc);
      if (ok) return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * HTTP Router for webhooks and external callbacks
 *
 * Handles:
 * - Bodycam live preview (proxy + draft injection)
 * - Clerk webhook for user events
 */

const http = httpRouter();

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
 * Clerk webhook handler
 * Creates user profile when a new user signs up.
 * Protected by Svix signature verification when CLERK_WEBHOOK_SECRET is set.
 */
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const rawBody = await request.text();

      const expectedSecret = process.env.CLERK_WEBHOOK_SECRET;
      if (expectedSecret) {
        const svixId = request.headers.get("svix-id");
        const svixTimestamp = request.headers.get("svix-timestamp");
        const svixSignature = request.headers.get("svix-signature");
        const valid = await verifySvixSignature(
          rawBody,
          svixId,
          svixTimestamp,
          svixSignature,
          expectedSecret
        );
        if (!valid) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
      } else {
        console.warn(
          "CLERK_WEBHOOK_SECRET not set — clerk webhook is publicly reachable"
        );
      }

      const body = JSON.parse(rawBody);
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

export default http;
