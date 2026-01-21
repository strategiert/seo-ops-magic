import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Convex Actions for Agent System
 *
 * These actions are HTTP-callable and wrap internal functions.
 * They can be called from Inngest agents running on Vercel.
 *
 * Note: These run without user authentication context.
 * They should validate inputs carefully.
 */

// ============ Brief Actions ============

export const getBrief = action({
  args: { briefId: v.string() },
  handler: async (ctx, { briefId }) => {
    const brief = await ctx.runQuery(internal.agents.internal.getBrief, {
      briefId: briefId as Id<"contentBriefs">,
    });
    return brief;
  },
});

// ============ Article Actions ============

export const createArticle = action({
  args: {
    projectId: v.string(),
    briefId: v.optional(v.string()),
    title: v.string(),
    primaryKeyword: v.optional(v.string()),
    contentMarkdown: v.optional(v.string()),
    contentHtml: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    outlineJson: v.optional(v.any()),
    faqJson: v.optional(v.any()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const articleId = await ctx.runMutation(internal.agents.internal.createArticle, {
      projectId: args.projectId as Id<"projects">,
      briefId: args.briefId ? (args.briefId as Id<"contentBriefs">) : undefined,
      title: args.title,
      primaryKeyword: args.primaryKeyword,
      contentMarkdown: args.contentMarkdown,
      contentHtml: args.contentHtml,
      metaTitle: args.metaTitle,
      metaDescription: args.metaDescription,
      outlineJson: args.outlineJson,
      faqJson: args.faqJson,
      status: args.status,
    });
    return { articleId };
  },
});

export const getArticle = action({
  args: { articleId: v.string() },
  handler: async (ctx, { articleId }) => {
    const article = await ctx.runQuery(internal.agents.internal.getArticle, {
      articleId: articleId as Id<"articles">,
    });
    return article;
  },
});

export const updateArticle = action({
  args: {
    articleId: v.string(),
    contentMarkdown: v.optional(v.string()),
    contentHtml: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    outlineJson: v.optional(v.any()),
    faqJson: v.optional(v.any()),
    status: v.optional(v.string()),
    wpPostId: v.optional(v.number()),
  },
  handler: async (ctx, { articleId, ...updates }) => {
    await ctx.runMutation(internal.agents.internal.updateArticle, {
      articleId: articleId as Id<"articles">,
      ...updates,
    });
    return { success: true };
  },
});

export const getProjectArticles = action({
  args: { projectId: v.string() },
  handler: async (ctx, { projectId }) => {
    const articles = await ctx.runQuery(internal.agents.internal.getProjectArticles, {
      projectId: projectId as Id<"projects">,
    });
    return articles;
  },
});

// ============ Brief Actions ============

export const updateBriefStatus = action({
  args: {
    briefId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, { briefId, status }) => {
    await ctx.runMutation(internal.agents.internal.updateBriefStatus, {
      briefId: briefId as Id<"contentBriefs">,
      status,
    });
    return { success: true };
  },
});

// ============ Content Assets Actions ============

export const createContentAsset = action({
  args: {
    projectId: v.string(),
    articleId: v.optional(v.string()),
    jobId: v.optional(v.string()),
    assetType: v.string(),
    platform: v.optional(v.string()),
    accountType: v.optional(v.string()),
    title: v.optional(v.string()),
    content: v.string(),
    contentJson: v.optional(v.any()),
    metadata: v.optional(v.any()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const assetId = await ctx.runMutation(internal.agents.internal.createContentAsset, {
      projectId: args.projectId as Id<"projects">,
      articleId: args.articleId ? (args.articleId as Id<"articles">) : undefined,
      jobId: args.jobId,
      assetType: args.assetType,
      platform: args.platform,
      accountType: args.accountType,
      title: args.title,
      content: args.content,
      contentJson: args.contentJson,
      metadata: args.metadata,
      status: args.status,
    });
    return { assetId };
  },
});

export const createContentAssetsBatch = action({
  args: {
    assets: v.array(
      v.object({
        projectId: v.string(),
        articleId: v.optional(v.string()),
        jobId: v.optional(v.string()),
        assetType: v.string(),
        platform: v.optional(v.string()),
        accountType: v.optional(v.string()),
        title: v.optional(v.string()),
        content: v.string(),
        contentJson: v.optional(v.any()),
        metadata: v.optional(v.any()),
        status: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { assets }) => {
    const mappedAssets = assets.map((a) => ({
      projectId: a.projectId as Id<"projects">,
      articleId: a.articleId ? (a.articleId as Id<"articles">) : undefined,
      jobId: a.jobId,
      assetType: a.assetType,
      platform: a.platform,
      accountType: a.accountType,
      title: a.title,
      content: a.content,
      contentJson: a.contentJson,
      metadata: a.metadata,
      status: a.status,
    }));

    const ids = await ctx.runMutation(internal.agents.internal.createContentAssetsBatch, {
      assets: mappedAssets,
    });
    return { assetIds: ids };
  },
});

// ============ Credits Actions ============

export const checkAndReserveCredits = action({
  args: {
    workspaceId: v.string(),
    agentId: v.string(),
    requiredCredits: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(internal.agents.internal.checkAndReserveCredits, {
      workspaceId: args.workspaceId as Id<"workspaces">,
      agentId: args.agentId,
      requiredCredits: args.requiredCredits,
    });
    return result;
  },
});

export const logUsage = action({
  args: {
    userId: v.string(),
    workspaceId: v.string(),
    projectId: v.optional(v.string()),
    agentId: v.string(),
    jobId: v.optional(v.string()),
    creditsUsed: v.number(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    articleId: v.optional(v.string()),
    briefId: v.optional(v.string()),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.runMutation(internal.agents.internal.logUsage, {
      userId: args.userId,
      workspaceId: args.workspaceId as Id<"workspaces">,
      projectId: args.projectId ? (args.projectId as Id<"projects">) : undefined,
      agentId: args.agentId,
      jobId: args.jobId,
      creditsUsed: args.creditsUsed,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      articleId: args.articleId ? (args.articleId as Id<"articles">) : undefined,
      briefId: args.briefId ? (args.briefId as Id<"contentBriefs">) : undefined,
      status: args.status,
      errorMessage: args.errorMessage,
      durationMs: args.durationMs,
    });
    return { logId };
  },
});

export const refundCredits = action({
  args: {
    workspaceId: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(internal.agents.internal.refundCredits, {
      workspaceId: args.workspaceId as Id<"workspaces">,
      amount: args.amount,
    });
    return result;
  },
});

// ============ Agent Job Actions ============

export const createAgentJob = action({
  args: {
    inngestEventId: v.string(),
    userId: v.string(),
    workspaceId: v.string(),
    projectId: v.optional(v.string()),
    agentId: v.string(),
    eventType: v.string(),
    inputData: v.any(),
    creditsReserved: v.number(),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.runMutation(internal.agents.internal.createAgentJob, {
      inngestEventId: args.inngestEventId,
      userId: args.userId,
      workspaceId: args.workspaceId as Id<"workspaces">,
      projectId: args.projectId ? (args.projectId as Id<"projects">) : undefined,
      agentId: args.agentId,
      eventType: args.eventType,
      inputData: args.inputData,
      creditsReserved: args.creditsReserved,
    });
    return { jobId };
  },
});

export const updateAgentJob = action({
  args: {
    inngestEventId: v.string(),
    status: v.optional(v.string()),
    progress: v.optional(v.number()),
    currentStep: v.optional(v.string()),
    result: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    creditsUsed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.runMutation(internal.agents.internal.updateAgentJob, args);
    return { jobId };
  },
});
