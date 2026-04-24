"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Google Search Console data actions.
 *
 * Each action:
 *   1. Resolves the project's gscConnection → googleAccount
 *   2. Refreshes the access token if close to expiry
 *   3. Calls searchAnalytics.query on GSC
 *   4. Optionally queries a second "previous period" for change metrics
 *
 * GSC has a 2-3 day data lag. We request `dataState: "final"` so the
 * numbers are deterministic (a re-request for the same window doesn't
 * change). startDate/endDate are inclusive; dates are UTC ISO (yyyy-mm-dd).
 */

const GSC_API = "https://www.googleapis.com/webmasters/v3";
const TOKEN_API = "https://oauth2.googleapis.com/token";

function requireOauthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured");
  }
  return { clientId, clientSecret };
}

async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number } | null> {
  try {
    const { clientId, clientSecret } = requireOauthConfig();
    const res = await fetch(TOKEN_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      console.error("Google refresh failed:", res.status, await res.text());
      return null;
    }
    const data: any = await res.json();
    const expiresAt = Date.now() + ((data.expires_in ?? 3600) - 30) * 1000;
    return { accessToken: data.access_token, expiresAt };
  } catch (err) {
    console.error("Google refresh threw:", err);
    return null;
  }
}

/**
 * Resolve a project's GSC context: returns an authed fetcher + the bound
 * siteUrl. Refreshes the stored access token in-place if needed.
 */
async function getGscContext(
  ctx: any,
  projectId: any
): Promise<{ siteUrl: string; accessToken: string } | { error: string }> {
  const connection = await ctx.runQuery(
    internal.tables.gscConnections.getByProjectInternal,
    { projectId }
  );
  if (!connection) return { error: "Kein GSC-Account für dieses Projekt verbunden." };

  const account = await ctx.runQuery(
    internal.tables.googleAccounts.getByIdInternal,
    { id: connection.googleAccountId }
  );
  if (!account) return { error: "Verbundener Google-Account existiert nicht mehr." };

  let accessToken: string = account.accessToken;
  if (account.expiresAt < Date.now() + 60_000) {
    const refreshed = await refreshAccessToken(account.refreshToken);
    if (!refreshed) {
      return {
        error:
          "Access-Token konnte nicht erneuert werden. Bitte Google-Account neu verbinden.",
      };
    }
    accessToken = refreshed.accessToken;
    await ctx.runMutation(internal.tables.googleAccounts.updateTokensInternal, {
      id: connection.googleAccountId,
      accessToken,
      expiresAt: refreshed.expiresAt,
    });
  }

  return { siteUrl: connection.gscProperty, accessToken };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function subtractDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() - n);
  return r;
}

/** Compute inclusive date range ending `gscLagDays` ago. */
function rangeForLastDays(
  days: number,
  gscLagDays = 3
): { startDate: string; endDate: string } {
  const end = subtractDays(new Date(), gscLagDays);
  const start = subtractDays(end, days - 1);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function previousRange(
  current: { startDate: string; endDate: string },
  days: number
): { startDate: string; endDate: string } {
  const prevEnd = subtractDays(new Date(current.startDate + "T00:00:00Z"), 1);
  const prevStart = subtractDays(prevEnd, days - 1);
  return { startDate: isoDate(prevStart), endDate: isoDate(prevEnd) };
}

interface GscQueryBody {
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
  startRow?: number;
  dataState?: "all" | "final";
  searchType?: "web" | "image" | "video" | "news" | "discover" | "googleNews";
}

interface GscRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function gscQuery(
  accessToken: string,
  siteUrl: string,
  body: GscQueryBody
): Promise<GscRow[]> {
  const url = `${GSC_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dataState: "final", ...body }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GSC API error (${res.status}): ${text}`);
  }
  const data: any = await res.json();
  return (data.rows ?? []) as GscRow[];
}

// ─────────────────────────────────────────────────── Performance + Trend

export const getPerformance = action({
  args: {
    projectId: v.id("projects"),
    days: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { projectId, days }
  ): Promise<{
    success: boolean;
    error?: string;
    range?: { startDate: string; endDate: string };
    previousRange?: { startDate: string; endDate: string };
    totals?: {
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    };
    previousTotals?: {
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    };
    daily?: Array<{
      date: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Unauthorized" };

    const n = days ?? 28;
    const range = rangeForLastDays(n);
    const prev = previousRange(range, n);

    const ctxGsc = await getGscContext(ctx, projectId);
    if ("error" in ctxGsc) return { success: false, error: ctxGsc.error };
    const { accessToken, siteUrl } = ctxGsc;

    try {
      // Fan out: daily series + current totals (no dims) + previous totals
      const [dailyRows, totalsRows, prevTotalsRows] = await Promise.all([
        gscQuery(accessToken, siteUrl, {
          startDate: range.startDate,
          endDate: range.endDate,
          dimensions: ["date"],
          rowLimit: 25000,
        }),
        gscQuery(accessToken, siteUrl, {
          startDate: range.startDate,
          endDate: range.endDate,
          rowLimit: 1,
        }),
        gscQuery(accessToken, siteUrl, {
          startDate: prev.startDate,
          endDate: prev.endDate,
          rowLimit: 1,
        }),
      ]);

      const daily = dailyRows
        .map((r) => ({
          date: r.keys?.[0] ?? "",
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
        }))
        .filter((d) => d.date)
        .sort((a, b) => a.date.localeCompare(b.date));

      const totals = totalsRows[0]
        ? {
            clicks: totalsRows[0].clicks,
            impressions: totalsRows[0].impressions,
            ctr: totalsRows[0].ctr,
            position: totalsRows[0].position,
          }
        : { clicks: 0, impressions: 0, ctr: 0, position: 0 };

      const previousTotals = prevTotalsRows[0]
        ? {
            clicks: prevTotalsRows[0].clicks,
            impressions: prevTotalsRows[0].impressions,
            ctr: prevTotalsRows[0].ctr,
            position: prevTotalsRows[0].position,
          }
        : { clicks: 0, impressions: 0, ctr: 0, position: 0 };

      return {
        success: true,
        range,
        previousRange: prev,
        totals,
        previousTotals,
        daily,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});

// ─────────────────────────────────────────────────── Top queries / pages

interface TopRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clicksChange: number;
  impressionsChange: number;
  positionChange: number;
}

function mergeTop(
  current: GscRow[],
  previous: GscRow[]
): TopRow[] {
  const prevMap = new Map<string, GscRow>();
  for (const p of previous) {
    const key = p.keys?.[0];
    if (key) prevMap.set(key, p);
  }
  return current
    .filter((r) => r.keys?.[0])
    .map((r) => {
      const key = r.keys![0];
      const prev = prevMap.get(key);
      return {
        key,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
        clicksChange: prev ? r.clicks - prev.clicks : r.clicks,
        impressionsChange: prev ? r.impressions - prev.impressions : r.impressions,
        // Note: position lower = better, so "change" is previous - current
        positionChange: prev ? prev.position - r.position : 0,
      };
    });
}

export const getTopQueries = action({
  args: {
    projectId: v.id("projects"),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { projectId, days, limit }
  ): Promise<{
    success: boolean;
    error?: string;
    range?: { startDate: string; endDate: string };
    rows?: TopRow[];
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Unauthorized" };

    const n = days ?? 28;
    const top = limit ?? 50;
    const range = rangeForLastDays(n);
    const prev = previousRange(range, n);

    const ctxGsc = await getGscContext(ctx, projectId);
    if ("error" in ctxGsc) return { success: false, error: ctxGsc.error };
    const { accessToken, siteUrl } = ctxGsc;

    try {
      const [cur, prv] = await Promise.all([
        gscQuery(accessToken, siteUrl, {
          startDate: range.startDate,
          endDate: range.endDate,
          dimensions: ["query"],
          rowLimit: top,
        }),
        gscQuery(accessToken, siteUrl, {
          startDate: prev.startDate,
          endDate: prev.endDate,
          dimensions: ["query"],
          rowLimit: 5000, // wider so we can merge change data even for long-tail
        }),
      ]);
      return { success: true, range, rows: mergeTop(cur, prv) };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});

export const getTopPages = action({
  args: {
    projectId: v.id("projects"),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { projectId, days, limit }
  ): Promise<{
    success: boolean;
    error?: string;
    range?: { startDate: string; endDate: string };
    rows?: TopRow[];
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Unauthorized" };

    const n = days ?? 28;
    const top = limit ?? 50;
    const range = rangeForLastDays(n);
    const prev = previousRange(range, n);

    const ctxGsc = await getGscContext(ctx, projectId);
    if ("error" in ctxGsc) return { success: false, error: ctxGsc.error };
    const { accessToken, siteUrl } = ctxGsc;

    try {
      const [cur, prv] = await Promise.all([
        gscQuery(accessToken, siteUrl, {
          startDate: range.startDate,
          endDate: range.endDate,
          dimensions: ["page"],
          rowLimit: top,
        }),
        gscQuery(accessToken, siteUrl, {
          startDate: prev.startDate,
          endDate: prev.endDate,
          dimensions: ["page"],
          rowLimit: 5000,
        }),
      ]);
      return { success: true, range, rows: mergeTop(cur, prv) };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});
