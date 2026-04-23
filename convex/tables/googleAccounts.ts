import { query, mutation, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Google OAuth account records, scoped per Clerk user.
 * Token handling (fetch, refresh, revoke) lives in actions/googleAuth.ts.
 */

/** List the current user's connected Google accounts. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const rows = await ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    // Never leak tokens to the client.
    return rows.map((r) => ({
      _id: r._id,
      email: r.email,
      grantedScopes: r.grantedScopes,
      connectedAt: r.connectedAt,
      lastRefreshedAt: r.lastRefreshedAt,
    }));
  },
});

/** Delete one of the current user's Google accounts. */
export const deleteMine = mutation({
  args: { id: v.id("googleAccounts") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId) {
      throw new Error("Account not found");
    }
    // Remove any gscConnections that point at this account
    const bindings = await ctx.db
      .query("gscConnections")
      .collect();
    for (const b of bindings) {
      if (b.googleAccountId === id) {
        await ctx.db.delete(b._id);
      }
    }
    await ctx.db.delete(id);
  },
});

// ─── Internal helpers for the OAuth/GSC actions (no auth) ────────────────

export const getByIdInternal = internalQuery({
  args: { id: v.id("googleAccounts") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const findByUserEmailInternal = internalQuery({
  args: { userId: v.string(), email: v.string() },
  handler: async (ctx, { userId, email }) => {
    return await ctx.db
      .query("googleAccounts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", userId).eq("email", email)
      )
      .first();
  },
});

export const upsertInternal = internalMutation({
  args: {
    userId: v.string(),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    grantedScopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleAccounts")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken || existing.refreshToken, // Google may omit refresh on reconnect
        expiresAt: args.expiresAt,
        grantedScopes: args.grantedScopes,
        lastRefreshedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("googleAccounts", {
      userId: args.userId,
      email: args.email,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      grantedScopes: args.grantedScopes,
      connectedAt: Date.now(),
    });
  },
});

export const updateTokensInternal = internalMutation({
  args: {
    id: v.id("googleAccounts"),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { id, accessToken, expiresAt }) => {
    await ctx.db.patch(id, {
      accessToken,
      expiresAt,
      lastRefreshedAt: Date.now(),
    });
  },
});
