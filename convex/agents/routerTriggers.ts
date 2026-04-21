import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Router Trigger - Startet den Router Agent
 * 
 * Der Router ist der Haupteinstiegspunkt für komplexe Anfragen.
 * Er analysiert die Anfrage und delegiert an spezialisierte Agents.
 */

// Router Agent cost
const ROUTER_CREDITS = 2;

/**
 * Send an event to Inngest
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

/**
 * Trigger the Router Agent with a user request
 * 
 * This is the main entry point for natural language requests.
 * 
 * Examples:
 * - "Erstelle einen Artikel aus dem Brief und veröffentliche ihn auf WordPress"
 * - "Generiere Social Posts für den letzten Artikel"
 * - "Komplette Content-Pipeline für diesen Brief"
 */
export const triggerRouter = action({
  args: {
    projectId: v.id("projects"),
    // Input options (at least one required)
    userMessage: v.optional(v.string()),
    briefId: v.optional(v.id("contentBriefs")),
    articleId: v.optional(v.id("articles")),
    // Control options
    requestedSkills: v.optional(v.array(v.string())),
    excludeSkills: v.optional(v.array(v.string())),
    autoExecute: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Validate: At least one input must be provided
    if (!args.userMessage && !args.briefId && !args.articleId) {
      throw new Error("At least one of userMessage, briefId, or articleId must be provided");
    }

    // Get project to find workspace
    const project = await ctx.runQuery(internal.tables.projects.getInternal, {
      id: args.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const workspaceId = project.workspaceId;

    // Check credits
    const creditCheck = await ctx.runMutation(internal.agents.internal.checkAndReserveCredits, {
      workspaceId,
      agentId: "router",
      requiredCredits: ROUTER_CREDITS,
    });

    if (!creditCheck.success) {
      return { success: false, error: creditCheck.error };
    }

    // Get Inngest event key
    const eventKey = process.env.INNGEST_EVENT_KEY;
    if (!eventKey) {
      await ctx.runMutation(internal.agents.internal.refundCredits, {
        workspaceId,
        amount: ROUTER_CREDITS,
      });
      throw new Error("INNGEST_EVENT_KEY not configured");
    }

    // Build router input
    const routerInput: Record<string, any> = {};
    if (args.userMessage) routerInput.userMessage = args.userMessage;
    if (args.briefId) routerInput.briefId = args.briefId;
    if (args.articleId) routerInput.articleId = args.articleId;
    if (args.requestedSkills) routerInput.requestedSkills = args.requestedSkills;
    if (args.excludeSkills) routerInput.excludeSkills = args.excludeSkills;
    if (args.autoExecute !== undefined) routerInput.autoExecute = args.autoExecute;

    // Send event to Inngest
    const eventResult = await sendInngestEvent(
      "agent/route",
      {
        workspaceId: workspaceId,
        projectId: args.projectId,
        userId: identity.subject,
        customerId: workspaceId,
        input: routerInput,
      },
      eventKey
    );

    if (!eventResult.success) {
      await ctx.runMutation(internal.agents.internal.refundCredits, {
        workspaceId,
        amount: ROUTER_CREDITS,
      });
      return { success: false, error: eventResult.error };
    }

    return {
      success: true,
      eventId: eventResult.eventId,
      message: "Router agent started - analyzing your request",
      creditsReserved: ROUTER_CREDITS,
    };
  },
});

/**
 * Quick action: Full content pipeline from brief
 * Convenience wrapper that triggers router with autoExecute
 */
export const triggerFullPipeline = action({
  args: {
    briefId: v.id("contentBriefs"),
    options: v.optional(v.object({
      generateSocialPosts: v.optional(v.boolean()),
      generatePressRelease: v.optional(v.boolean()),
      generateAdCopies: v.optional(v.boolean()),
      publishToWordPress: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get brief to find project
    const brief = await ctx.runQuery(internal.agents.internal.getBrief, { briefId: args.briefId });
    if (!brief) {
      throw new Error("Brief not found");
    }

    // Build user message based on options
    const opts = args.options || {};
    const tasks: string[] = ["Erstelle einen SEO-Artikel aus dem Brief"];
    
    if (opts.generateSocialPosts !== false) {
      tasks.push("generiere Social Media Posts");
    }
    if (opts.generatePressRelease) {
      tasks.push("erstelle eine Pressemitteilung");
    }
    if (opts.generateAdCopies) {
      tasks.push("erstelle Werbetexte");
    }
    if (opts.publishToWordPress) {
      tasks.push("veröffentliche auf WordPress");
    }

    const userMessage = tasks.join(", ");

    // Get project
    const project = await ctx.runQuery(internal.tables.projects.getInternal, {
      id: brief.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const workspaceId = project.workspaceId;

    // Estimate total credits
    let estimatedCredits = 2; // Router
    estimatedCredits += 10; // SEO Writer
    estimatedCredits += 3;  // HTML Designer (always runs after article)
    if (opts.generateSocialPosts !== false) estimatedCredits += 5;
    if (opts.generatePressRelease) estimatedCredits += 6;
    if (opts.generateAdCopies) estimatedCredits += 4;
    if (opts.publishToWordPress) estimatedCredits += 1;

    // Check credits for full pipeline
    const creditCheck = await ctx.runMutation(internal.agents.internal.checkAndReserveCredits, {
      workspaceId,
      agentId: "router",
      requiredCredits: estimatedCredits,
    });

    if (!creditCheck.success) {
      return { success: false, error: creditCheck.error };
    }

    const eventKey = process.env.INNGEST_EVENT_KEY;
    if (!eventKey) {
      await ctx.runMutation(internal.agents.internal.refundCredits, {
        workspaceId,
        amount: estimatedCredits,
      });
      throw new Error("INNGEST_EVENT_KEY not configured");
    }

    const eventResult = await sendInngestEvent(
      "agent/route",
      {
        workspaceId: workspaceId,
        projectId: brief.projectId,
        userId: identity.subject,
        customerId: workspaceId,
        input: {
          userMessage,
          briefId: args.briefId,
          autoExecute: true,
        },
      },
      eventKey
    );

    if (!eventResult.success) {
      await ctx.runMutation(internal.agents.internal.refundCredits, {
        workspaceId,
        amount: estimatedCredits,
      });
      return { success: false, error: eventResult.error };
    }

    // Update brief status
    await ctx.runMutation(internal.agents.internal.updateBriefStatus, {
      briefId: args.briefId,
      status: "in_progress",
    });

    return {
      success: true,
      eventId: eventResult.eventId,
      message: "Full content pipeline started",
      estimatedCredits,
      tasks,
    };
  },
});

/**
 * Get router job result (poll for completion)
 */
export const getRouterJobResult = action({
  args: {
    eventId: v.string(),
  },
  handler: async (ctx, { eventId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const job = await ctx.runQuery(internal.agents.internal.getAgentJobByEventId, {
      inngestEventId: eventId,
    });

    if (!job) {
      return { found: false };
    }

    return {
      found: true,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      result: job.result,
      error: job.errorMessage,
    };
  },
});
