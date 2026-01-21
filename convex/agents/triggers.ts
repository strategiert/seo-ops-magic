import { v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Agent Trigger System
 *
 * Sends events to Inngest to trigger agent execution.
 * Provides mutations for UI buttons and queries for job status.
 *
 * Flow:
 * UI → triggerAgent() → Inngest Event → Agent Function → Convex Updates
 */

// Agent cost definitions (must match src/inngest/lib/convex.ts)
const AGENT_CREDITS: Record<string, number> = {
  "seo-writer": 10,
  "html-designer": 3,
  "wp-publisher": 1,
  "internal-linker": 5,
  "social-creator": 5,
  "ad-copy-writer": 4,
  "press-release": 6,
  "newsletter": 5,
  "image-generator": 8,
};

// Event types for each agent
const AGENT_EVENTS: Record<string, string> = {
  "seo-writer": "article/generate",
  "html-designer": "article/transform-html",
  "wp-publisher": "article/publish-wordpress",
  "internal-linker": "article/published",
  "social-creator": "content/generate-social-posts",
  "ad-copy-writer": "content/generate-ad-copies",
  "press-release": "content/generate-press-release",
};

// ============ Event Sender ============

/**
 * Send an event to Inngest
 * Uses Inngest REST API: POST https://inn.gs/e/{eventKey}
 */
async function sendInngestEvent(
  eventName: string,
  data: Record<string, any>,
  eventKey: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const response = await fetch(`https://inn.gs/e/${eventKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: eventName,
        data,
        ts: Date.now(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Inngest API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { success: true, eventId: result.ids?.[0] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error sending event",
    };
  }
}

// ============ Trigger Actions ============

/**
 * Trigger article generation from a brief
 */
export const triggerArticleGeneration = action({
  args: {
    briefId: v.id("contentBriefs"),
  },
  handler: async (ctx, { briefId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get brief to find project and workspace
    const brief = await ctx.runQuery(internal.agents.internal.getBrief, { briefId });
    if (!brief) {
      throw new Error("Brief not found");
    }

    // Get project to find workspace
    const project = await ctx.runQuery(internal.tables.projects.getInternal, {
      id: brief.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const workspaceId = project.workspaceId;
    const agentId = "seo-writer";
    const requiredCredits = AGENT_CREDITS[agentId];

    // Check credits first
    const creditCheck = await ctx.runMutation(internal.agents.internal.checkAndReserveCredits, {
      workspaceId,
      agentId,
      requiredCredits,
    });

    if (!creditCheck.success) {
      return { success: false, error: creditCheck.error };
    }

    // Get Inngest event key from environment
    const eventKey = process.env.INNGEST_EVENT_KEY;
    if (!eventKey) {
      // Refund credits if we can't send the event
      await ctx.runMutation(internal.agents.internal.refundCredits, {
        workspaceId,
        amount: requiredCredits,
      });
      throw new Error("INNGEST_EVENT_KEY not configured");
    }

    // Send event to Inngest
    const eventResult = await sendInngestEvent(
      "article/generate",
      {
        briefId: briefId,
        projectId: brief.projectId,
        userId: identity.subject,
        customerId: workspaceId, // For concurrency control
        workspaceId: workspaceId,
      },
      eventKey
    );

    if (!eventResult.success) {
      // Refund credits on failure
      await ctx.runMutation(internal.agents.internal.refundCredits, {
        workspaceId,
        amount: requiredCredits,
      });
      return { success: false, error: eventResult.error };
    }

    // Update brief status
    await ctx.runMutation(internal.agents.internal.updateBriefStatus, {
      briefId,
      status: "in_progress",
    });

    return {
      success: true,
      eventId: eventResult.eventId,
      message: "Article generation started",
      creditsReserved: requiredCredits,
    };
  },
});

/**
 * Trigger HTML transformation for an article
 */
export const triggerHtmlTransformation = action({
  args: {
    articleId: v.id("articles"),
  },
  handler: async (ctx, { articleId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get article to find project and workspace
    const article = await ctx.runQuery(internal.agents.internal.getArticle, { articleId });
    if (!article) {
      throw new Error("Article not found");
    }

    // Get project to find workspace
    const project = await ctx.runQuery(internal.tables.projects.getInternal, {
      id: article.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const workspaceId = project.workspaceId;
    const agentId = "html-designer";
    const requiredCredits = AGENT_CREDITS[agentId];

    // Check credits
    const creditCheck = await ctx.runMutation(internal.agents.internal.checkAndReserveCredits, {
      workspaceId,
      agentId,
      requiredCredits,
    });

    if (!creditCheck.success) {
      return { success: false, error: creditCheck.error };
    }

    const eventKey = process.env.INNGEST_EVENT_KEY;
    if (!eventKey) {
      await ctx.runMutation(internal.agents.internal.refundCredits, {
        workspaceId,
        amount: requiredCredits,
      });
      throw new Error("INNGEST_EVENT_KEY not configured");
    }

    const eventResult = await sendInngestEvent(
      "article/transform-html",
      {
        articleId: articleId,
        projectId: article.projectId,
        userId: identity.subject,
        customerId: workspaceId,
        workspaceId: workspaceId,
      },
      eventKey
    );

    if (!eventResult.success) {
      await ctx.runMutation(internal.agents.internal.refundCredits, {
        workspaceId,
        amount: requiredCredits,
      });
      return { success: false, error: eventResult.error };
    }

    return {
      success: true,
      eventId: eventResult.eventId,
      message: "HTML transformation started",
      creditsReserved: requiredCredits,
    };
  },
});

/**
 * Trigger WordPress publishing for an article
 */
export const triggerWordPressPublish = action({
  args: {
    articleId: v.id("articles"),
    status: v.optional(v.union(v.literal("draft"), v.literal("publish"))),
  },
  handler: async (ctx, { articleId, status = "draft" }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const article = await ctx.runQuery(internal.agents.internal.getArticle, { articleId });
    if (!article) {
      throw new Error("Article not found");
    }

    const project = await ctx.runQuery(internal.tables.projects.getInternal, {
      id: article.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const workspaceId = project.workspaceId;
    const agentId = "wp-publisher";
    const requiredCredits = AGENT_CREDITS[agentId];

    const creditCheck = await ctx.runMutation(internal.agents.internal.checkAndReserveCredits, {
      workspaceId,
      agentId,
      requiredCredits,
    });

    if (!creditCheck.success) {
      return { success: false, error: creditCheck.error };
    }

    const eventKey = process.env.INNGEST_EVENT_KEY;
    if (!eventKey) {
      await ctx.runMutation(internal.agents.internal.refundCredits, {
        workspaceId,
        amount: requiredCredits,
      });
      throw new Error("INNGEST_EVENT_KEY not configured");
    }

    const eventResult = await sendInngestEvent(
      "article/publish-wordpress",
      {
        articleId: articleId,
        projectId: article.projectId,
        userId: identity.subject,
        customerId: workspaceId,
        workspaceId: workspaceId,
        status,
      },
      eventKey
    );

    if (!eventResult.success) {
      await ctx.runMutation(internal.agents.internal.refundCredits, {
        workspaceId,
        amount: requiredCredits,
      });
      return { success: false, error: eventResult.error };
    }

    return {
      success: true,
      eventId: eventResult.eventId,
      message: `WordPress ${status} started`,
      creditsReserved: requiredCredits,
    };
  },
});

/**
 * Trigger social post generation for an article
 */
export const triggerSocialPosts = action({
  args: {
    articleId: v.id("articles"),
    platforms: v.array(v.string()),
  },
  handler: async (ctx, { articleId, platforms }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const article = await ctx.runQuery(internal.agents.internal.getArticle, { articleId });
    if (!article) {
      throw new Error("Article not found");
    }

    const project = await ctx.runQuery(internal.tables.projects.getInternal, {
      id: article.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const workspaceId = project.workspaceId;
    const agentId = "social-creator";
    const requiredCredits = AGENT_CREDITS[agentId];

    const creditCheck = await ctx.runMutation(internal.agents.internal.checkAndReserveCredits, {
      workspaceId,
      agentId,
      requiredCredits,
    });

    if (!creditCheck.success) {
      return { success: false, error: creditCheck.error };
    }

    const eventKey = process.env.INNGEST_EVENT_KEY;
    if (!eventKey) {
      await ctx.runMutation(internal.agents.internal.refundCredits, {
        workspaceId,
        amount: requiredCredits,
      });
      throw new Error("INNGEST_EVENT_KEY not configured");
    }

    const eventResult = await sendInngestEvent(
      "content/generate-social-posts",
      {
        articleId: articleId,
        projectId: article.projectId,
        userId: identity.subject,
        customerId: workspaceId,
        workspaceId: workspaceId,
        platforms,
      },
      eventKey
    );

    if (!eventResult.success) {
      await ctx.runMutation(internal.agents.internal.refundCredits, {
        workspaceId,
        amount: requiredCredits,
      });
      return { success: false, error: eventResult.error };
    }

    return {
      success: true,
      eventId: eventResult.eventId,
      message: `Social post generation started for ${platforms.join(", ")}`,
      creditsReserved: requiredCredits,
    };
  },
});

// ============ Job Status Queries ============

/**
 * Get active jobs for a workspace (real-time updates)
 */
export const getActiveJobs = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, { workspaceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const jobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", "running")
      )
      .collect();

    // Also get queued jobs
    const queuedJobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", "queued")
      )
      .collect();

    return [...jobs, ...queuedJobs].sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Get job history for a workspace
 */
export const getJobHistory = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { workspaceId, limit = 20 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get all jobs ordered by creation time
    const jobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_workspace_status", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(limit);

    return jobs;
  },
});

/**
 * Get a specific job's status
 */
export const getJobStatus = query({
  args: {
    jobId: v.id("agentJobs"),
  },
  handler: async (ctx, { jobId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await ctx.db.get(jobId);
  },
});

/**
 * Get jobs for a specific article
 */
export const getArticleJobs = query({
  args: {
    articleId: v.id("articles"),
  },
  handler: async (ctx, { articleId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get article's project
    const article = await ctx.db.get(articleId);
    if (!article) return [];

    const jobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_project", (q) => q.eq("projectId", article.projectId))
      .filter((q) =>
        q.or(
          q.eq(q.field("inputData.articleId"), articleId),
          q.eq(q.field("result.articleId"), articleId)
        )
      )
      .order("desc")
      .take(10);

    return jobs;
  },
});
