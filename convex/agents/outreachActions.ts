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
    throw new Error("Unauthorized outreach worker");
  }
}

export const getCampaignContext = action({
  args: {
    campaignId: v.string(),
    workerSecret: v.string(),
  },
  handler: async (ctx, { campaignId, workerSecret }) => {
    assertWorkerAuthorized(workerSecret);

    return await ctx.runQuery(internal.tables.outreachInternal.getCampaignContext, {
      campaignId: campaignId as Id<"outreachCampaigns">,
    });
  },
});

export const saveStrategyOutput = action({
  args: {
    campaignId: v.string(),
    workerSecret: v.string(),
    strategyJson: v.any(),
    prospects: v.array(
      v.object({
        domain: v.string(),
        url: v.optional(v.string()),
        method: v.optional(v.string()),
        score: v.optional(v.number()),
        tier: v.optional(v.string()),
        reasoning: v.optional(v.string()),
        contactEmail: v.optional(v.string()),
        contactName: v.optional(v.string()),
        contactPage: v.optional(v.string()),
      })
    ),
    sequence: v.object({
      name: v.string(),
      steps: v.array(v.any()),
      variants: v.optional(v.any()),
    }),
  },
  handler: async (ctx, { campaignId, workerSecret, ...strategyOutput }) => {
    assertWorkerAuthorized(workerSecret);

    return await ctx.runMutation(
      internal.tables.outreachInternal.saveStrategyOutput,
      {
        campaignId: campaignId as Id<"outreachCampaigns">,
        ...strategyOutput,
      }
    );
  },
});
