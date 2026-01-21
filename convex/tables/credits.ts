import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Credit System for AI Agent Usage
 *
 * Handles:
 * - Credit balance tracking per workspace
 * - Usage logging for all agent executions
 * - Tier-based feature access (Core, Growth, Enterprise)
 * - Monthly credit reset logic
 */

// Tier definitions with credits and enabled agents
export const TIERS = {
  free: {
    monthlyAllowance: 50,
    concurrencyLimit: 1,
    enabledAgents: ["seo-writer"], // Only basic writing
  },
  core: {
    monthlyAllowance: 500,
    concurrencyLimit: 3,
    enabledAgents: [
      "seo-writer",
      "html-designer",
      "wp-publisher",
      "internal-linker",
    ],
  },
  growth: {
    monthlyAllowance: 2000,
    concurrencyLimit: 5,
    enabledAgents: [
      "seo-writer",
      "html-designer",
      "wp-publisher",
      "internal-linker",
      "social-creator",
      "ad-copy-writer",
      "newsletter",
      "image-generator",
    ],
  },
  enterprise: {
    monthlyAllowance: 10000,
    concurrencyLimit: 10,
    enabledAgents: [
      "seo-writer",
      "html-designer",
      "wp-publisher",
      "internal-linker",
      "social-creator",
      "ad-copy-writer",
      "newsletter",
      "image-generator",
      "press-release",
      "press-outreach",
      "link-building",
      "editorial-researcher",
      "content-translator",
      "video-creator",
      "carousel-designer",
      "company-social",
      "employee-advocacy",
      "linkbait-creator",
    ],
  },
} as const;

export type TierName = keyof typeof TIERS;

// ============ Queries ============

/**
 * Get credit balance for a user's workspace
 */
export const getBalance = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const credits = await ctx.db
      .query("credits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!credits) {
      return null;
    }

    return {
      balance: credits.balance,
      tier: credits.tier,
      monthlyAllowance: credits.monthlyAllowance,
      bonusCredits: credits.bonusCredits || 0,
      enabledAgents: credits.enabledAgents || TIERS[credits.tier as TierName]?.enabledAgents || [],
      concurrencyLimit: credits.concurrencyLimit || TIERS[credits.tier as TierName]?.concurrencyLimit || 1,
      resetDay: credits.resetDay,
      lastResetAt: credits.lastResetAt,
    };
  },
});

/**
 * Check if user has enough credits for an agent
 */
export const checkCredits = query({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.string(),
    requiredCredits: v.number(),
  },
  handler: async (ctx, { workspaceId, agentId, requiredCredits }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { allowed: false, reason: "Not authenticated" };
    }

    const credits = await ctx.db
      .query("credits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!credits) {
      return { allowed: false, reason: "No credit record found" };
    }

    // Check tier access
    const enabledAgents = credits.enabledAgents || TIERS[credits.tier as TierName]?.enabledAgents || [];
    if (!enabledAgents.includes(agentId)) {
      return {
        allowed: false,
        reason: `Agent "${agentId}" is not available in your tier (${credits.tier})`,
        upgradeTo: agentId.includes("press") || agentId.includes("link") ? "enterprise" : "growth",
      };
    }

    // Check balance
    if (credits.balance < requiredCredits) {
      return {
        allowed: false,
        reason: `Insufficient credits. Required: ${requiredCredits}, Available: ${credits.balance}`,
        balance: credits.balance,
        required: requiredCredits,
      };
    }

    return {
      allowed: true,
      balance: credits.balance,
      afterDeduction: credits.balance - requiredCredits,
    };
  },
});

/**
 * Get usage history for a workspace
 */
export const getUsageHistory = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, limit = 50 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const usage = await ctx.db
      .query("usageLog")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(limit);

    return usage;
  },
});

/**
 * Get usage statistics for a workspace
 */
export const getUsageStats = query({
  args: {
    workspaceId: v.id("workspaces"),
    periodDays: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, periodDays = 30 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const startDate = Date.now() - periodDays * 24 * 60 * 60 * 1000;

    const usage = await ctx.db
      .query("usageLog")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .filter((q) => q.gte(q.field("startedAt"), startDate))
      .collect();

    // Aggregate by agent
    const byAgent: Record<string, { count: number; credits: number; tokens: number }> = {};
    let totalCredits = 0;
    let totalTokens = 0;

    for (const log of usage) {
      if (!byAgent[log.agentId]) {
        byAgent[log.agentId] = { count: 0, credits: 0, tokens: 0 };
      }
      byAgent[log.agentId].count++;
      byAgent[log.agentId].credits += log.creditsUsed;
      byAgent[log.agentId].tokens += log.totalTokens || 0;
      totalCredits += log.creditsUsed;
      totalTokens += log.totalTokens || 0;
    }

    return {
      periodDays,
      totalExecutions: usage.length,
      totalCredits,
      totalTokens,
      byAgent,
    };
  },
});

// ============ Mutations ============

/**
 * Initialize credits for a new workspace
 */
export const initialize = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    tier: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceId, tier = "free" }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if already initialized
    const existing = await ctx.db
      .query("credits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (existing) {
      return existing._id;
    }

    const tierConfig = TIERS[tier as TierName] || TIERS.free;

    const creditId = await ctx.db.insert("credits", {
      userId: identity.subject,
      workspaceId,
      balance: tierConfig.monthlyAllowance,
      tier,
      monthlyAllowance: tierConfig.monthlyAllowance,
      resetDay: new Date().getDate(), // Reset on same day each month
      lastResetAt: Date.now(),
      enabledAgents: tierConfig.enabledAgents,
      concurrencyLimit: tierConfig.concurrencyLimit,
    });

    return creditId;
  },
});

/**
 * Reserve credits before starting a job
 * Returns reservation ID that must be confirmed or released
 */
export const reserve = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.string(),
    amount: v.number(),
    jobId: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceId, agentId, amount, jobId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const credits = await ctx.db
      .query("credits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!credits) {
      throw new Error("No credit record found for workspace");
    }

    if (credits.balance < amount) {
      throw new Error(`Insufficient credits. Required: ${amount}, Available: ${credits.balance}`);
    }

    // Deduct credits
    await ctx.db.patch(credits._id, {
      balance: credits.balance - amount,
    });

    return {
      previousBalance: credits.balance,
      reserved: amount,
      newBalance: credits.balance - amount,
    };
  },
});

/**
 * Deduct credits and log usage
 */
export const deduct = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    agentId: v.string(),
    jobId: v.optional(v.string()),
    creditsUsed: v.number(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    articleId: v.optional(v.id("articles")),
    briefId: v.optional(v.id("contentBriefs")),
    status: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Log usage
    const logId = await ctx.db.insert("usageLog", {
      userId: identity.subject,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      agentId: args.agentId,
      jobId: args.jobId,
      creditsUsed: args.creditsUsed,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: (args.inputTokens || 0) + (args.outputTokens || 0),
      articleId: args.articleId,
      briefId: args.briefId,
      status: args.status || "completed",
      errorMessage: args.errorMessage,
      startedAt: Date.now(),
      completedAt: Date.now(),
    });

    return { logId };
  },
});

/**
 * Add bonus credits to a workspace
 */
export const addBonus = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    amount: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceId, amount, reason }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const credits = await ctx.db
      .query("credits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!credits) {
      throw new Error("No credit record found");
    }

    await ctx.db.patch(credits._id, {
      balance: credits.balance + amount,
      bonusCredits: (credits.bonusCredits || 0) + amount,
    });

    return {
      previousBalance: credits.balance,
      added: amount,
      newBalance: credits.balance + amount,
    };
  },
});

/**
 * Upgrade tier for a workspace
 */
export const upgradeTier = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    newTier: v.string(),
  },
  handler: async (ctx, { workspaceId, newTier }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (!(newTier in TIERS)) {
      throw new Error(`Invalid tier: ${newTier}`);
    }

    const credits = await ctx.db
      .query("credits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!credits) {
      throw new Error("No credit record found");
    }

    const tierConfig = TIERS[newTier as TierName];

    // Calculate prorated credits if upgrading mid-month
    const daysInMonth = 30;
    const dayOfMonth = new Date().getDate();
    const daysRemaining = daysInMonth - dayOfMonth;
    const proratedCredits = Math.floor((tierConfig.monthlyAllowance / daysInMonth) * daysRemaining);

    await ctx.db.patch(credits._id, {
      tier: newTier,
      monthlyAllowance: tierConfig.monthlyAllowance,
      balance: credits.balance + proratedCredits,
      enabledAgents: tierConfig.enabledAgents,
      concurrencyLimit: tierConfig.concurrencyLimit,
    });

    return {
      previousTier: credits.tier,
      newTier,
      proratedCredits,
      newBalance: credits.balance + proratedCredits,
    };
  },
});

/**
 * Monthly credit reset (called by scheduled function)
 */
export const monthlyReset = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!credits) {
      return null;
    }

    // Reset to monthly allowance (don't carry over unused credits)
    await ctx.db.patch(credits._id, {
      balance: credits.monthlyAllowance + (credits.bonusCredits || 0),
      lastResetAt: Date.now(),
    });

    return {
      resetBalance: credits.monthlyAllowance + (credits.bonusCredits || 0),
    };
  },
});
