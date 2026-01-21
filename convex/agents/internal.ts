import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Internal Convex Functions for Agent System
 *
 * These functions are called by Inngest agents via HTTP.
 * They bypass user authentication since they run as system operations.
 *
 * Security: These are internal functions - not exposed to clients.
 * They should only be called via Convex Actions that validate the caller.
 */

// ============ Brief Queries ============

export const getBrief = internalQuery({
  args: { briefId: v.id("contentBriefs") },
  handler: async (ctx, { briefId }) => {
    const brief = await ctx.db.get(briefId);
    if (!brief) return null;

    // Get project for defaults
    const project = await ctx.db.get(brief.projectId);

    return {
      ...brief,
      project: project
        ? {
            domain: project.domain,
            defaultLanguage: project.defaultLanguage || "de",
            defaultCountry: project.defaultCountry || "DE",
            defaultTonality: project.defaultTonality,
            defaultTargetAudience: project.defaultTargetAudience,
          }
        : null,
    };
  },
});

// ============ Article Mutations ============

export const createArticle = internalMutation({
  args: {
    projectId: v.id("projects"),
    briefId: v.optional(v.id("contentBriefs")),
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
    const articleId = await ctx.db.insert("articles", {
      projectId: args.projectId,
      briefId: args.briefId,
      title: args.title,
      primaryKeyword: args.primaryKeyword,
      contentMarkdown: args.contentMarkdown,
      contentHtml: args.contentHtml,
      metaTitle: args.metaTitle,
      metaDescription: args.metaDescription,
      outlineJson: args.outlineJson,
      faqJson: args.faqJson,
      status: args.status || "draft",
      version: 1,
    });

    return articleId;
  },
});

export const getArticle = internalQuery({
  args: { articleId: v.id("articles") },
  handler: async (ctx, { articleId }) => {
    const article = await ctx.db.get(articleId);
    if (!article) return null;

    // Get project for WordPress config
    const project = await ctx.db.get(article.projectId);

    // Get WordPress integration if exists
    const wpIntegration = project
      ? await ctx.db
          .query("integrations")
          .withIndex("by_project_type", (q) =>
            q.eq("projectId", project._id).eq("type", "wordpress")
          )
          .first()
      : null;

    return {
      ...article,
      project: project
        ? {
            _id: project._id,
            domain: project.domain,
            wpUrl: project.wpUrl,
          }
        : null,
      wpIntegration: wpIntegration
        ? {
            wpUsername: wpIntegration.wpUsername,
            wpAppPassword: wpIntegration.wpAppPassword,
            isVerified: wpIntegration.wpIsVerified,
          }
        : null,
    };
  },
});

export const updateArticle = internalMutation({
  args: {
    articleId: v.id("articles"),
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
    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(articleId, filteredUpdates);
    }

    return articleId;
  },
});

// ============ Brief Mutations ============

export const updateBriefStatus = internalMutation({
  args: {
    briefId: v.id("contentBriefs"),
    status: v.string(),
  },
  handler: async (ctx, { briefId, status }) => {
    await ctx.db.patch(briefId, { status });
    return briefId;
  },
});

// ============ Content Assets ============

export const createContentAsset = internalMutation({
  args: {
    projectId: v.id("projects"),
    articleId: v.optional(v.id("articles")),
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
    const assetId = await ctx.db.insert("contentAssets", {
      projectId: args.projectId,
      articleId: args.articleId,
      jobId: args.jobId,
      assetType: args.assetType,
      platform: args.platform,
      accountType: args.accountType,
      title: args.title,
      content: args.content,
      contentJson: args.contentJson,
      metadata: args.metadata,
      status: args.status || "draft",
    });

    return assetId;
  },
});

export const createContentAssetsBatch = internalMutation({
  args: {
    assets: v.array(
      v.object({
        projectId: v.id("projects"),
        articleId: v.optional(v.id("articles")),
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
    const ids = await Promise.all(
      assets.map((asset) =>
        ctx.db.insert("contentAssets", {
          ...asset,
          status: asset.status || "draft",
        })
      )
    );

    return ids;
  },
});

// ============ Project Queries ============

export const getProjectArticles = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return articles.map((a) => ({
      _id: a._id,
      title: a.title,
      primaryKeyword: a.primaryKeyword,
      status: a.status,
    }));
  },
});

// ============ Credits & Usage ============

export const checkAndReserveCredits = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    agentId: v.string(),
    requiredCredits: v.number(),
  },
  handler: async (ctx, { workspaceId, agentId, requiredCredits }) => {
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!credits) {
      return { success: false, error: "No credit record found" };
    }

    // Check tier access
    const enabledAgents = credits.enabledAgents || [];
    if (Array.isArray(enabledAgents) && !enabledAgents.includes(agentId)) {
      return {
        success: false,
        error: `Agent "${agentId}" not available in tier "${credits.tier}"`,
      };
    }

    // Check balance
    if (credits.balance < requiredCredits) {
      return {
        success: false,
        error: `Insufficient credits. Need ${requiredCredits}, have ${credits.balance}`,
      };
    }

    // Reserve credits
    await ctx.db.patch(credits._id, {
      balance: credits.balance - requiredCredits,
    });

    return {
      success: true,
      previousBalance: credits.balance,
      newBalance: credits.balance - requiredCredits,
      reserved: requiredCredits,
    };
  },
});

export const logUsage = internalMutation({
  args: {
    userId: v.string(),
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    agentId: v.string(),
    jobId: v.optional(v.string()),
    creditsUsed: v.number(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    articleId: v.optional(v.id("articles")),
    briefId: v.optional(v.id("contentBriefs")),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("usageLog", {
      userId: args.userId,
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
      status: args.status,
      errorMessage: args.errorMessage,
      startedAt: Date.now(),
      completedAt: args.status === "completed" ? Date.now() : undefined,
      durationMs: args.durationMs,
    });

    return logId;
  },
});

export const refundCredits = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    amount: v.number(),
  },
  handler: async (ctx, { workspaceId, amount }) => {
    const credits = await ctx.db
      .query("credits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!credits) {
      return { success: false };
    }

    await ctx.db.patch(credits._id, {
      balance: credits.balance + amount,
    });

    return { success: true, newBalance: credits.balance + amount };
  },
});

// ============ Agent Jobs ============

export const createAgentJob = internalMutation({
  args: {
    inngestEventId: v.string(),
    userId: v.string(),
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    agentId: v.string(),
    eventType: v.string(),
    inputData: v.any(),
    creditsReserved: v.number(),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("agentJobs", {
      inngestEventId: args.inngestEventId,
      userId: args.userId,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      agentId: args.agentId,
      eventType: args.eventType,
      inputData: args.inputData,
      status: "queued",
      creditsReserved: args.creditsReserved,
      createdAt: Date.now(),
    });

    return jobId;
  },
});

export const updateAgentJob = internalMutation({
  args: {
    inngestEventId: v.string(),
    status: v.optional(v.string()),
    progress: v.optional(v.number()),
    currentStep: v.optional(v.string()),
    result: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    creditsUsed: v.optional(v.number()),
  },
  handler: async (ctx, { inngestEventId, ...updates }) => {
    const job = await ctx.db
      .query("agentJobs")
      .withIndex("by_inngest_event", (q) => q.eq("inngestEventId", inngestEventId))
      .first();

    if (!job) {
      return null;
    }

    const patchData: Record<string, any> = {};

    if (updates.status !== undefined) {
      patchData.status = updates.status;
      if (updates.status === "running" && !job.startedAt) {
        patchData.startedAt = Date.now();
      }
      if (updates.status === "completed" || updates.status === "failed") {
        patchData.completedAt = Date.now();
      }
    }
    if (updates.progress !== undefined) patchData.progress = updates.progress;
    if (updates.currentStep !== undefined) patchData.currentStep = updates.currentStep;
    if (updates.result !== undefined) patchData.result = updates.result;
    if (updates.errorMessage !== undefined) patchData.errorMessage = updates.errorMessage;
    if (updates.creditsUsed !== undefined) patchData.creditsUsed = updates.creditsUsed;

    await ctx.db.patch(job._id, patchData);

    return job._id;
  },
});
