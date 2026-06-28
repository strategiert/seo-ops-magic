import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { requireAuth } from "../auth";

async function verifyProjectAccess(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  userId: string
): Promise<boolean> {
  const project = await ctx.db.get(projectId);
  if (!project) return false;

  const workspace = await ctx.db.get(project.workspaceId);
  return workspace?.ownerId === userId;
}

export const listPlacements = query({
  args: { campaignId: v.id("outreachCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const userId = await requireAuth(ctx);
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) return [];
    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) return [];

    return await ctx.db
      .query("linkPlacements")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();
  },
});

export const createPlacement = mutation({
  args: {
    campaignId: v.id("outreachCampaigns"),
    prospectId: v.optional(v.id("outreachProspects")),
    goalId: v.optional(v.id("outreachGoals")),
    sourceUrl: v.string(),
    targetUrl: v.string(),
    anchorText: v.optional(v.string()),
    rel: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    if (args.prospectId) {
      const prospect = await ctx.db.get(args.prospectId);
      if (
        !prospect ||
        prospect.campaignId !== args.campaignId ||
        prospect.projectId !== campaign.projectId
      ) {
        throw new Error("Prospect does not belong to this campaign");
      }
    }

    if (args.goalId) {
      const goal = await ctx.db.get(args.goalId);
      if (!goal || goal.campaignId !== args.campaignId || goal.projectId !== campaign.projectId) {
        throw new Error("Goal does not belong to this campaign");
      }
    }

    const now = Date.now();
    const placementId = await ctx.db.insert("linkPlacements", {
      projectId: campaign.projectId,
      campaignId: args.campaignId,
      prospectId: args.prospectId,
      goalId: args.goalId,
      sourceUrl: args.sourceUrl,
      targetUrl: args.targetUrl,
      anchorText: args.anchorText,
      rel: args.rel,
      status: args.status ?? "manual",
      createdAt: now,
      updatedAt: now,
    });

    if (args.goalId) {
      await ctx.db.patch(args.goalId, {
        status: "verified",
        sourceUrl: args.sourceUrl,
        targetUrl: args.targetUrl,
        verifiedAt: now,
        updatedAt: now,
      });
    }

    return placementId;
  },
});
