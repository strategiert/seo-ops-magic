import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

export const getCampaignContext = internalQuery({
  args: {
    campaignId: v.id("outreachCampaigns"),
  },
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) return null;

    const project = await ctx.db.get(campaign.projectId);
    const workspace = project ? await ctx.db.get(project.workspaceId) : null;
    const brandProfile = project
      ? await ctx.db
          .query("brandProfiles")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .first()
      : null;

    const targetArticleIds = campaign.targetArticleIds ?? [];
    const articles = (
      await Promise.all(
        targetArticleIds.map((articleId) => ctx.db.get(articleId))
      )
    ).filter((article) => article !== null);

    const [prospects, contacts] = await Promise.all([
      ctx.db
        .query("outreachProspects")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
        .collect(),
      ctx.db
        .query("outreachContacts")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
        .collect(),
    ]);

    return {
      campaign,
      project,
      workspace,
      brandProfile,
      articles,
      prospects,
      contacts,
    };
  },
});

export const saveStrategyOutput = internalMutation({
  args: {
    campaignId: v.id("outreachCampaigns"),
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
  handler: async (ctx, { campaignId, strategyJson, prospects, sequence }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const now = Date.now();

    await ctx.db.patch(campaignId, {
      strategyJson,
      status: "ready",
      updatedAt: now,
    });

    const existingProspects = await ctx.db
      .query("outreachProspects")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();

    const seenDomains = new Set(
      existingProspects.map((prospect) => normalizeDomain(prospect.domain))
    );
    const insertedProspectIds: Id<"outreachProspects">[] = [];

    for (const prospect of prospects) {
      const normalizedDomain = normalizeDomain(prospect.domain);
      if (seenDomains.has(normalizedDomain)) {
        continue;
      }

      seenDomains.add(normalizedDomain);

      const hasContactLocation = Boolean(
        prospect.contactEmail || prospect.contactPage
      );
      const hasContactInfo = Boolean(
        prospect.contactEmail || prospect.contactName || prospect.contactPage
      );

      const prospectId = await ctx.db.insert("outreachProspects", {
        projectId: campaign.projectId,
        campaignId,
        campaignType: campaign.campaignType,
        domain: prospect.domain,
        status: prospect.score !== undefined ? "qualified" : "new",
        contactStatus: hasContactLocation ? "found" : "missing",
        createdAt: now,
        updatedAt: now,
        ...stripUndefined({
          url: prospect.url,
          method: prospect.method,
          score: prospect.score,
          tier: prospect.tier,
          reasoning: prospect.reasoning,
        }),
      });

      insertedProspectIds.push(prospectId);

      if (hasContactInfo) {
        await ctx.db.insert("outreachContacts", {
          projectId: campaign.projectId,
          campaignId,
          prospectId,
          source: "ai_strategy",
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

    const sequenceId = await ctx.db.insert("outreachSequences", {
      projectId: campaign.projectId,
      campaignId,
      name: sequence.name,
      steps: sequence.steps,
      approvalStatus: "draft",
      createdAt: now,
      updatedAt: now,
      ...stripUndefined({
        variants: sequence.variants,
      }),
    });

    return { insertedProspectIds, sequenceId };
  },
});
