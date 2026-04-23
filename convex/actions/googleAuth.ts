"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Google OAuth flow for connecting a user's Google account.
 *
 * Uses Google's Authorization-Code flow with PKCE would be ideal for a SPA;
 * since our client_secret lives only in Convex env (not in the browser), we
 * can use the standard web-app flow safely:
 *   1) Frontend opens popup → Google OAuth consent → Google redirects
 *      popup to /oauth/google/callback.html with ?code=...&state=...
 *   2) Popup posts the code back to the parent window via postMessage
 *   3) Parent calls exchangeCode({code}) which runs here, on Convex
 *   4) Here we trade the code + client_secret for tokens, call Google
 *      userinfo to get the account email, persist in googleAccounts.
 *
 * Also supplies refreshAccessTokenForAccount (internal helper used by the
 * GSC data actions when access_token is close to expiry).
 *
 * Scopes requested:
 *   - openid + email (for account identification)
 *   - https://www.googleapis.com/auth/webmasters.readonly (read GSC)
 */

const REQUIRED_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/webmasters.readonly",
];

const REDIRECT_URI_FALLBACK = "https://notamsign.com/oauth/google/callback.html";

function getRedirectUri(): string {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || REDIRECT_URI_FALLBACK;
}

function requireOauthConfig(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured");
  }
  return { clientId, clientSecret };
}

/**
 * Build the Google OAuth consent URL the frontend should open in a popup.
 * `state` is echoed back unchanged — the frontend uses it to tie the popup
 * response to the original request and to prevent cross-tab confusion.
 */
export const getAuthUrl = action({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const { clientId } = requireOauthConfig();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getRedirectUri(),
      response_type: "code",
      scope: REQUIRED_SCOPES.join(" "),
      access_type: "offline",     // needed to get a refresh_token
      prompt: "consent",          // force refresh_token issue every time
      include_granted_scopes: "true",
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },
});

/**
 * Exchange an authorization code for tokens, fetch the user's email, and
 * persist the connection. Called by the frontend after the popup posts
 * the code back.
 */
export const exchangeCode = action({
  args: { code: v.string() },
  handler: async (ctx, { code }): Promise<{
    success: boolean;
    email?: string;
    accountId?: string;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Unauthorized" };

    const { clientId, clientSecret } = requireOauthConfig();

    // 1) Code → tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("Google token exchange failed:", tokenRes.status, body);
      return {
        success: false,
        error: `Google token exchange failed (${tokenRes.status})`,
      };
    }
    const tokens: any = await tokenRes.json();
    if (!tokens.refresh_token) {
      // This user already granted before and chose not to re-consent.
      // Since we need the refresh token to persist long-term access, ask
      // the user to fully revoke access at accounts.google.com and retry.
      return {
        success: false,
        error:
          "Kein Refresh-Token von Google erhalten. Bitte den Zugriff unter myaccount.google.com/permissions entziehen und erneut verbinden.",
      };
    }

    // 2) Look up the account email via userinfo
    const userinfoRes = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );
    if (!userinfoRes.ok) {
      return { success: false, error: "Failed to load Google user info" };
    }
    const userinfo: any = await userinfoRes.json();
    const email: string | undefined = userinfo.email;
    if (!email) return { success: false, error: "No email in Google profile" };

    // 3) Persist the connection
    const expiresAt = Date.now() + ((tokens.expires_in ?? 3600) - 30) * 1000;
    const grantedScopes: string[] = (tokens.scope ?? "").split(" ").filter(Boolean);

    const accountId = await ctx.runMutation(
      internal.tables.googleAccounts.upsertInternal,
      {
        userId: identity.subject,
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        grantedScopes,
      }
    );

    return { success: true, email, accountId };
  },
});

/**
 * List the GSC properties (sites) accessible by the given Google account.
 * Used in the project-settings UI so the user can pick which property to
 * bind to the current project. Transparently refreshes the access token
 * when it's close to expiry.
 */
export const listPropertiesForAccount = action({
  args: { googleAccountId: v.id("googleAccounts") },
  handler: async (
    ctx,
    { googleAccountId }
  ): Promise<{
    success: boolean;
    properties?: Array<{ siteUrl: string; permissionLevel: string }>;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Unauthorized" };

    const account = await ctx.runQuery(
      internal.tables.googleAccounts.getByIdInternal,
      { id: googleAccountId }
    );
    if (!account || account.userId !== identity.subject) {
      return { success: false, error: "Account not found" };
    }

    let accessToken = account.accessToken;
    if (account.expiresAt < Date.now() + 60_000) {
      const refreshed = await refreshAccessToken(account.refreshToken);
      if (!refreshed) return { success: false, error: "Token refresh failed" };
      accessToken = refreshed.accessToken;
      await ctx.runMutation(
        internal.tables.googleAccounts.updateTokensInternal,
        {
          id: googleAccountId,
          accessToken,
          expiresAt: refreshed.expiresAt,
        }
      );
    }

    const res = await fetch(
      "https://www.googleapis.com/webmasters/v3/sites",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error("GSC sites list failed:", res.status, body);
      return {
        success: false,
        error: `Konnte GSC-Properties nicht laden (${res.status}). Hat der Google-Account Zugriff auf Search Console?`,
      };
    }
    const data: any = await res.json();
    const properties = (data.siteEntry ?? []).map((s: any) => ({
      siteUrl: String(s.siteUrl ?? ""),
      permissionLevel: String(s.permissionLevel ?? ""),
    }));
    return { success: true, properties };
  },
});

async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number } | null> {
  try {
    const { clientId, clientSecret } = requireOauthConfig();
    const res = await fetch("https://oauth2.googleapis.com/token", {
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
