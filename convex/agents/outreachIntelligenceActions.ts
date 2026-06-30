"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { constantTimeEqual } from "../lib/constantTimeEqual";

function assertWorkerAuthorized(workerSecret: string): void {
  // TODO(security P0-4): OUTREACH_WORKER_SECRET in Prod-Env zwingend setzen, dann
  // den INNGEST_EVENT_KEY-Fallback entfernen (geteilter Key vermischt Trust-Domains).
  const expectedSecret =
    process.env.OUTREACH_WORKER_SECRET || process.env.INNGEST_EVENT_KEY;

  if (!expectedSecret) {
    throw new Error("OUTREACH_WORKER_SECRET is not configured");
  }

  if (!constantTimeEqual(workerSecret, expectedSecret)) {
    throw new Error("Unauthorized outreach intelligence worker");
  }
}

export const createRunning = action({
  args: {
    projectId: v.string(),
    workerSecret: v.string(),
  },
  handler: async (ctx, { projectId, workerSecret }) => {
    assertWorkerAuthorized(workerSecret);

    return await ctx.runMutation(
      internal.tables.outreachIntelligence.createRunning,
      {
        projectId: projectId as Id<"projects">,
      }
    );
  },
});

export const markRunning = action({
  args: {
    analysisId: v.string(),
    workerSecret: v.string(),
  },
  handler: async (ctx, { analysisId, workerSecret }) => {
    assertWorkerAuthorized(workerSecret);

    await ctx.runMutation(internal.tables.outreachIntelligence.markRunning, {
      analysisId: analysisId as Id<"outreachAnalyses">,
    });
  },
});

export const getContext = action({
  args: {
    projectId: v.string(),
    workerSecret: v.string(),
  },
  handler: async (ctx, { projectId, workerSecret }) => {
    assertWorkerAuthorized(workerSecret);

    return await ctx.runQuery(internal.tables.outreachIntelligence.getContext, {
      projectId: projectId as Id<"projects">,
    });
  },
});

export const createGeneratedCampaign = action({
  args: {
    projectId: v.string(),
    name: v.string(),
    campaignType: v.string(),
    workerSecret: v.string(),
    targetDomain: v.optional(v.string()),
    targetArticleIds: v.optional(v.array(v.string())),
    competitors: v.optional(v.array(v.string())),
    goalTargetsJson: v.optional(v.any()),
    strategyJson: v.optional(v.any()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { workerSecret, projectId, targetArticleIds, ...data }) => {
    assertWorkerAuthorized(workerSecret);

    return await ctx.runMutation(
      internal.tables.outreach.createGeneratedCampaignInternal,
      {
        projectId: projectId as Id<"projects">,
        targetArticleIds: targetArticleIds?.map(
          (articleId) => articleId as Id<"articles">
        ),
        ...data,
      }
    );
  },
});

export const saveCompleted = action({
  args: {
    analysisId: v.string(),
    summary: v.string(),
    sourceCoverageJson: v.any(),
    opportunitiesJson: v.any(),
    recommendedCampaignJson: v.any(),
    workerSecret: v.string(),
    createdCampaignId: v.optional(v.string()),
  },
  handler: async (ctx, { workerSecret, analysisId, createdCampaignId, ...data }) => {
    assertWorkerAuthorized(workerSecret);

    await ctx.runMutation(internal.tables.outreachIntelligence.saveCompleted, {
      analysisId: analysisId as Id<"outreachAnalyses">,
      createdCampaignId: createdCampaignId as Id<"outreachCampaigns"> | undefined,
      ...data,
    });
  },
});

export const saveFailed = action({
  args: {
    analysisId: v.string(),
    errorMessage: v.string(),
    workerSecret: v.string(),
  },
  handler: async (ctx, { analysisId, errorMessage, workerSecret }) => {
    assertWorkerAuthorized(workerSecret);

    await ctx.runMutation(internal.tables.outreachIntelligence.saveFailed, {
      analysisId: analysisId as Id<"outreachAnalyses">,
      errorMessage,
    });
  },
});
