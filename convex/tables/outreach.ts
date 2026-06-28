import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Verify user has access to a project.
 * Access is granted when the user owns the workspace containing the project.
 */
async function verifyProjectAccess(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  userId: string
): Promise<boolean> {
  const project = await ctx.db.get(projectId);
  if (!project) return false;

  const workspace = await ctx.db.get(project.workspaceId);
  if (!workspace) return false;

  return workspace.ownerId === userId;
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  const cleaned: Partial<T> = {};

  for (const key of Object.keys(value) as Array<keyof T>) {
    const entryValue = value[key];
    if (entryValue !== undefined) {
      cleaned[key] = entryValue;
    }
  }

  return cleaned;
}

async function validateTargetArticleIds(
  ctx: QueryCtx | MutationCtx,
  targetArticleIds: Id<"articles">[] | undefined,
  projectId: Id<"projects">
): Promise<void> {
  if (targetArticleIds === undefined) return;

  for (const articleId of targetArticleIds) {
    const article = await ctx.db.get(articleId);

    if (!article) {
      throw new Error(`Invalid targetArticleIds: Article ${articleId} not found`);
    }

    if (article.projectId !== projectId) {
      throw new Error(
        `Invalid targetArticleIds: Article ${articleId} belongs to another project`
      );
    }
  }
}

export const listCampaigns = query({
  args: {
    projectId: v.id("projects"),
    campaignType: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, campaignType }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      return [];
    }

    if (campaignType !== undefined) {
      return await ctx.db
        .query("outreachCampaigns")
        .withIndex("by_project_type", (q) =>
          q.eq("projectId", projectId).eq("campaignType", campaignType)
        )
        .collect();
    }

    return await ctx.db
      .query("outreachCampaigns")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const getCampaignBundle = query({
  args: {
    campaignId: v.id("outreachCampaigns"),
  },
  handler: async (ctx, { campaignId }) => {
    const userId = await requireAuth(ctx);

    const campaign = await ctx.db.get(campaignId);
    if (!campaign) return null;

    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) {
      return null;
    }

    const [assets, prospects, contacts, sequences, goals] = await Promise.all([
      ctx.db
        .query("outreachAssets")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
        .collect(),
      ctx.db
        .query("outreachProspects")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
        .collect(),
      ctx.db
        .query("outreachContacts")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
        .collect(),
      ctx.db
        .query("outreachSequences")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
        .collect(),
      ctx.db
        .query("outreachGoals")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
        .collect(),
    ]);

    return {
      campaign,
      assets,
      prospects,
      contacts,
      sequences,
      goals,
    };
  },
});

export const createCampaign = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    campaignType: v.string(),
    targetDomain: v.optional(v.string()),
    targetArticleIds: v.optional(v.array(v.id("articles"))),
    competitors: v.optional(v.array(v.string())),
    goalTargetsJson: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, args.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    await validateTargetArticleIds(ctx, args.targetArticleIds, args.projectId);

    const now = Date.now();

    return await ctx.db.insert("outreachCampaigns", {
      projectId: args.projectId,
      name: args.name,
      campaignType: args.campaignType,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      ...stripUndefined({
        targetDomain: args.targetDomain,
        targetArticleIds: args.targetArticleIds,
        competitors: args.competitors,
        goalTargetsJson: args.goalTargetsJson,
      }),
    });
  },
});

export const updateCampaign = mutation({
  args: {
    campaignId: v.id("outreachCampaigns"),
    name: v.optional(v.string()),
    targetDomain: v.optional(v.string()),
    targetArticleIds: v.optional(v.array(v.id("articles"))),
    competitors: v.optional(v.array(v.string())),
    goalTargetsJson: v.optional(v.any()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { campaignId, ...updates }) => {
    const userId = await requireAuth(ctx);

    const campaign = await ctx.db.get(campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    await validateTargetArticleIds(
      ctx,
      updates.targetArticleIds,
      campaign.projectId
    );

    await ctx.db.patch(campaignId, {
      ...stripUndefined(updates),
      updatedAt: Date.now(),
    });

    return campaignId;
  },
});

export const createProspectsBatch = mutation({
  args: {
    campaignId: v.id("outreachCampaigns"),
    prospects: v.array(
      v.object({
        domain: v.string(),
        url: v.optional(v.string()),
        method: v.optional(v.string()),
        contactEmail: v.optional(v.string()),
        contactName: v.optional(v.string()),
        contactPage: v.optional(v.string()),
        reasoning: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { campaignId, prospects }) => {
    const userId = await requireAuth(ctx);

    const campaign = await ctx.db.get(campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    const insertedProspectIds: Id<"outreachProspects">[] = [];

    for (const prospect of prospects) {
      const now = Date.now();
      const hasContactLocation = Boolean(prospect.contactEmail || prospect.contactPage);
      const hasContact = Boolean(
        prospect.contactEmail || prospect.contactName || prospect.contactPage
      );

      const prospectId = await ctx.db.insert("outreachProspects", {
        projectId: campaign.projectId,
        campaignId,
        campaignType: campaign.campaignType,
        domain: prospect.domain,
        status: "new",
        contactStatus: hasContactLocation ? "found" : "missing",
        createdAt: now,
        updatedAt: now,
        ...stripUndefined({
          url: prospect.url,
          method: prospect.method,
          reasoning: prospect.reasoning,
        }),
      });

      insertedProspectIds.push(prospectId);

      if (hasContact) {
        await ctx.db.insert("outreachContacts", {
          projectId: campaign.projectId,
          campaignId,
          prospectId,
          source: "import",
          suppressed: false,
          createdAt: now,
          updatedAt: now,
          ...stripUndefined({
            name: prospect.contactName,
            email: prospect.contactEmail,
            contactPage: prospect.contactPage,
          }),
        });
      }
    }

    return insertedProspectIds;
  },
});

export const updateProspect = mutation({
  args: {
    prospectId: v.id("outreachProspects"),
    method: v.optional(v.string()),
    score: v.optional(v.number()),
    tier: v.optional(v.string()),
    status: v.optional(v.string()),
    reasoning: v.optional(v.string()),
    contactStatus: v.optional(v.string()),
  },
  handler: async (ctx, { prospectId, ...updates }) => {
    const userId = await requireAuth(ctx);

    const prospect = await ctx.db.get(prospectId);
    if (!prospect) {
      throw new Error("Prospect not found");
    }

    if (!(await verifyProjectAccess(ctx, prospect.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    const now = Date.now();

    await ctx.db.patch(prospectId, {
      ...stripUndefined(updates),
      lastTouchedAt: now,
      updatedAt: now,
    });

    return prospectId;
  },
});

export const updateContact = mutation({
  args: {
    contactId: v.id("outreachContacts"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    email: v.optional(v.string()),
    contactPage: v.optional(v.string()),
    source: v.optional(v.string()),
    suppressed: v.optional(v.boolean()),
    suppressionReason: v.optional(v.string()),
  },
  handler: async (ctx, { contactId, ...updates }) => {
    const userId = await requireAuth(ctx);

    const contact = await ctx.db.get(contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    if (!(await verifyProjectAccess(ctx, contact.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    await ctx.db.patch(contactId, {
      ...stripUndefined(updates),
      updatedAt: Date.now(),
    });

    return contactId;
  },
});

export const upsertSequence = mutation({
  args: {
    campaignId: v.id("outreachCampaigns"),
    sequenceId: v.optional(v.id("outreachSequences")),
    name: v.string(),
    steps: v.array(v.any()),
    variants: v.optional(v.any()),
    approvalStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    const now = Date.now();

    if (args.sequenceId) {
      const sequence = await ctx.db.get(args.sequenceId);
      if (!sequence) {
        throw new Error("Sequence not found");
      }

      if (
        sequence.campaignId !== args.campaignId ||
        sequence.projectId !== campaign.projectId
      ) {
        throw new Error("Unauthorized: Sequence does not belong to this campaign");
      }

      await ctx.db.patch(args.sequenceId, {
        name: args.name,
        steps: args.steps,
        approvalStatus: args.approvalStatus,
        updatedAt: now,
        ...stripUndefined({
          variants: args.variants,
        }),
      });

      return args.sequenceId;
    }

    return await ctx.db.insert("outreachSequences", {
      projectId: campaign.projectId,
      campaignId: args.campaignId,
      name: args.name,
      steps: args.steps,
      approvalStatus: args.approvalStatus,
      createdAt: now,
      updatedAt: now,
      ...stripUndefined({
        variants: args.variants,
      }),
    });
  },
});

export const createGoal = mutation({
  args: {
    campaignId: v.id("outreachCampaigns"),
    prospectId: v.optional(v.id("outreachProspects")),
    goalType: v.string(),
    targetUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    if (args.prospectId) {
      const prospect = await ctx.db.get(args.prospectId);
      if (!prospect || prospect.campaignId !== args.campaignId) {
        throw new Error("Prospect not found");
      }
    }

    const now = Date.now();
    const status = args.status ?? "open";

    return await ctx.db.insert("outreachGoals", {
      projectId: campaign.projectId,
      campaignId: args.campaignId,
      goalType: args.goalType,
      status,
      createdAt: now,
      updatedAt: now,
      ...stripUndefined({
        prospectId: args.prospectId,
        targetUrl: args.targetUrl,
        sourceUrl: args.sourceUrl,
        description: args.description,
        verifiedAt: status === "verified" ? now : undefined,
      }),
    });
  },
});

export const updateGoal = mutation({
  args: {
    goalId: v.id("outreachGoals"),
    prospectId: v.optional(v.id("outreachProspects")),
    goalType: v.optional(v.string()),
    targetUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { goalId, ...updates }) => {
    const userId = await requireAuth(ctx);

    const goal = await ctx.db.get(goalId);
    if (!goal) {
      throw new Error("Goal not found");
    }

    if (!(await verifyProjectAccess(ctx, goal.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    if (updates.prospectId !== undefined) {
      const prospect = await ctx.db.get(updates.prospectId);
      if (
        !prospect ||
        prospect.projectId !== goal.projectId ||
        prospect.campaignId !== goal.campaignId
      ) {
        throw new Error("Invalid prospectId: Prospect does not belong to this goal");
      }
    }

    const now = Date.now();

    await ctx.db.patch(goalId, {
      ...stripUndefined(updates),
      updatedAt: now,
      ...stripUndefined({
        verifiedAt:
          updates.status === "verified" && goal.verifiedAt === undefined
            ? now
            : undefined,
      }),
    });

    return goalId;
  },
});

export const prospectStats = query({
  args: {
    campaignId: v.id("outreachCampaigns"),
  },
  handler: async (ctx, { campaignId }) => {
    const userId = await requireAuth(ctx);

    const campaign = await ctx.db.get(campaignId);
    if (!campaign) return null;

    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) {
      return null;
    }

    const prospects = await ctx.db
      .query("outreachProspects")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();

    const goals = await ctx.db
      .query("outreachGoals")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();

    const byStatus: Record<string, number> = {};
    const byTier: Record<string, number> = {};

    for (const prospect of prospects) {
      byStatus[prospect.status] = (byStatus[prospect.status] ?? 0) + 1;

      const tier = prospect.tier ?? "unassigned";
      byTier[tier] = (byTier[tier] ?? 0) + 1;
    }

    return {
      totalProspects: prospects.length,
      byStatus,
      byTier,
      wonGoals: goals.filter(
        (goal) => goal.status === "won" || goal.status === "verified"
      ).length,
      openGoals: goals.filter((goal) => goal.status === "open").length,
    };
  },
});
