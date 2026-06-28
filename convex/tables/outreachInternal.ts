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

function canonicalizeDomain(input: string): string {
  const normalizedInput = input.trim().toLowerCase();
  if (normalizedInput === "") return normalizedInput;

  let domain = normalizedInput;

  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    try {
      domain = new URL(domain).hostname;
    } catch {
      domain = domain.replace(/^https?:\/\//, "");
    }
  }

  domain = domain.split(/[/?#]/)[0];
  domain = domain.split(":")[0];

  if (domain.startsWith("www.")) {
    domain = domain.slice(4);
  }

  return domain;
}

function normalizeContactValue(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue === "" ? undefined : normalizedValue;
}

function hasGeneratedContact(prospect: {
  contactEmail?: string;
  contactName?: string;
  contactPage?: string;
}): boolean {
  return Boolean(
    prospect.contactEmail || prospect.contactName || prospect.contactPage
  );
}

function hasContactLocation(prospect: {
  contactEmail?: string;
  contactPage?: string;
}): boolean {
  return Boolean(prospect.contactEmail || prospect.contactPage);
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

    const [existingProspects, existingContacts, existingSequences] =
      await Promise.all([
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
      ]);

    const prospectsByDomain = new Map<
      string,
      { id: Id<"outreachProspects">; contactStatus?: string }
    >();
    for (const prospect of existingProspects) {
      prospectsByDomain.set(canonicalizeDomain(prospect.domain), {
        id: prospect._id,
        contactStatus: prospect.contactStatus,
      });
    }

    const contactsByProspectId = new Map<
      Id<"outreachProspects">,
      typeof existingContacts
    >();
    for (const contact of existingContacts) {
      const prospectContacts = contactsByProspectId.get(contact.prospectId) ?? [];
      prospectContacts.push(contact);
      contactsByProspectId.set(contact.prospectId, prospectContacts);
    }

    const insertedProspectIds: Id<"outreachProspects">[] = [];

    for (const prospect of prospects) {
      const canonicalDomain = canonicalizeDomain(prospect.domain);
      const existingProspect = prospectsByDomain.get(canonicalDomain);

      if (existingProspect) {
        if (!hasGeneratedContact(prospect)) {
          continue;
        }

        const existingProspectContacts =
          contactsByProspectId.get(existingProspect.id) ?? [];
        const contactEmail = normalizeContactValue(prospect.contactEmail);
        const contactPage = normalizeContactValue(prospect.contactPage);
        const contactName = normalizeContactValue(prospect.contactName);
        const contactExists = existingProspectContacts.some((contact) => {
          if (contactEmail !== undefined) {
            return normalizeContactValue(contact.email) === contactEmail;
          }

          return (
            normalizeContactValue(contact.contactPage) === contactPage &&
            normalizeContactValue(contact.name) === contactName
          );
        });

        if (contactExists) {
          continue;
        }

        const contactId = await ctx.db.insert("outreachContacts", {
          projectId: campaign.projectId,
          campaignId,
          prospectId: existingProspect.id,
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

        const createdContact = await ctx.db.get(contactId);
        if (createdContact) {
          existingProspectContacts.push(createdContact);
          contactsByProspectId.set(existingProspect.id, existingProspectContacts);
        }

        if (existingProspect.contactStatus !== "found") {
          await ctx.db.patch(existingProspect.id, {
            contactStatus: "found",
            updatedAt: now,
          });
          existingProspect.contactStatus = "found";
        }

        continue;
      }

      const prospectId = await ctx.db.insert("outreachProspects", {
        projectId: campaign.projectId,
        campaignId,
        campaignType: campaign.campaignType,
        domain: canonicalDomain,
        status: prospect.score !== undefined ? "qualified" : "new",
        contactStatus: hasContactLocation(prospect) ? "found" : "missing",
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
      prospectsByDomain.set(canonicalDomain, {
        id: prospectId,
        contactStatus: hasContactLocation(prospect) ? "found" : "missing",
      });

      if (hasGeneratedContact(prospect)) {
        const contactId = await ctx.db.insert("outreachContacts", {
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

        const createdContact = await ctx.db.get(contactId);
        if (createdContact) {
          contactsByProspectId.set(prospectId, [createdContact]);
        }
      }
    }

    const draftSequence = existingSequences.find(
      (existingSequence) => existingSequence.approvalStatus === "draft"
    );
    const sequenceId = draftSequence
      ? draftSequence._id
      : await ctx.db.insert("outreachSequences", {
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

    if (draftSequence) {
      await ctx.db.patch(draftSequence._id, {
        name: sequence.name,
        steps: sequence.steps,
        updatedAt: now,
        ...stripUndefined({
          variants: sequence.variants,
        }),
      });
    }

    return { insertedProspectIds, sequenceId };
  },
});
