import { action, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { requireProjectAccess } from "../auth";
import { constantTimeEqual } from "../lib/constantTimeEqual";
import { stripUndefined } from "../lib/objects";
import {
  buildOutreachEmailDraft,
  normalizeEmail,
  type OutreachSuppressionLike,
} from "../lib/outreachMailCore";

type CampaignContext = {
  campaign: any;
  project: any;
  workspaceId: Id<"workspaces">;
};

const DEFAULT_DAILY_LIMIT = 40;

function getWorkerSecret(): string {
  const workerSecret = process.env.OUTREACH_WORKER_SECRET || process.env.INNGEST_EVENT_KEY;
  if (!workerSecret) {
    throw new Error("OUTREACH_WORKER_SECRET is not configured");
  }
  return workerSecret;
}

function assertWorkerSecret(workerSecret: string): void {
  if (!constantTimeEqual(workerSecret, getWorkerSecret())) {
    throw new Error("Unauthorized outreach mail worker");
  }
}

async function getCampaignContext(
  ctx: QueryCtx | MutationCtx,
  campaignId: Id<"outreachCampaigns">
): Promise<CampaignContext> {
  const campaign = await ctx.db.get(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const project = await ctx.db.get(campaign.projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  return { campaign, project, workspaceId: project.workspaceId };
}

function fromAddress(fromName: string, fromEmail: string): string {
  const name = fromName.trim();
  return name ? `${name} <${fromEmail}>` : fromEmail;
}

function optOutUrlFor(token: string): string {
  const baseUrl =
    process.env.PUBLIC_APP_URL ||
    process.env.VITE_PUBLIC_APP_URL ||
    process.env.VITE_APP_URL ||
    "https://notamsign.com";
  return `${baseUrl.replace(/\/$/, "")}/outreach/opt-out/${token}`;
}

function tokenFor(contactId: Id<"outreachContacts">, now: number): string {
  return `${contactId}-${now.toString(36)}`;
}

function defaultMailbox(workspaceId: Id<"workspaces">, projectId: Id<"projects">) {
  const fromEmail =
    process.env.RESEND_DEFAULT_FROM_EMAIL ||
    process.env.OUTREACH_FROM_EMAIL ||
    "outreach@notamsign.com";
  const fromName = process.env.RESEND_DEFAULT_FROM_NAME || "Klaus Arent";
  const senderAddress =
    process.env.OUTREACH_SENDER_ADDRESS ||
    "Klaus Arent, c/o notamsign.com";

  return {
    _id: undefined as Id<"outreachMailboxes"> | undefined,
    workspaceId,
    projectId,
    provider: "resend" as const,
    fromEmail,
    fromName,
    replyTo: process.env.OUTREACH_REPLY_TO || fromEmail,
    senderAddress,
    status: "active",
    dailyLimit: DEFAULT_DAILY_LIMIT,
    sentToday: 0,
  };
}

async function resolveMailbox(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  projectId: Id<"projects">
) {
  const projectMailboxes = await ctx.db
    .query("outreachMailboxes")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  const projectMailbox = projectMailboxes.find((mailbox) => mailbox.status === "active");
  if (projectMailbox) return projectMailbox;

  const workspaceMailboxes = await ctx.db
    .query("outreachMailboxes")
    .withIndex("by_workspace_status", (q) =>
      q.eq("workspaceId", workspaceId).eq("status", "active")
    )
    .collect();
  return workspaceMailboxes[0] || defaultMailbox(workspaceId, projectId);
}

async function getActiveSuppressions(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  projectId: Id<"projects">
): Promise<OutreachSuppressionLike[]> {
  const workspaceSuppressions = await ctx.db
    .query("outreachSuppressions")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const projectSuppressions = await ctx.db
    .query("outreachSuppressions")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();

  return [...workspaceSuppressions, ...projectSuppressions]
    .filter((suppression) => suppression.active)
    .map((suppression) => ({
      scope: suppression.scope,
      value: suppression.value,
      active: suppression.active,
    }));
}

function variablesFor(prospect: any, contact: any, campaign: any) {
  const firstName = typeof contact.name === "string" ? contact.name.split(/\s+/)[0] : "";
  return {
    firstName,
    siteName: prospect.domain || campaign.targetDomain || "",
    topic: campaign.name || campaign.targetDomain || "unsere Ressource",
    senderName: process.env.RESEND_DEFAULT_FROM_NAME || "Klaus",
  };
}

export const getCampaignSendReadiness = query({
  args: {
    campaignId: v.id("outreachCampaigns"),
  },
  handler: async (ctx, { campaignId }) => {
    const { campaign, project, workspaceId } = await getCampaignContext(ctx, campaignId);
    try {
      await requireProjectAccess(ctx, campaign.projectId);
    } catch {
      return null;
    }

    const [prospects, contacts, sequences, messages] = await Promise.all([
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
        .query("outreachMessages")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
        .collect(),
    ]);

    const sequence =
      [...sequences].sort((a, b) => b.updatedAt - a.updatedAt).find((item) => item.approvalStatus === "approved") ||
      null;
    const suppressions = await getActiveSuppressions(ctx, workspaceId, project._id);
    const mailbox = await resolveMailbox(ctx, workspaceId, project._id);
    const prospectById = new Map(prospects.map((prospect) => [prospect._id, prospect]));
    const blocked: Record<string, number> = {};
    let eligibleContacts = 0;

    for (const contact of contacts) {
      const prospect = prospectById.get(contact.prospectId);
      if (!prospect) continue;

      const evaluation = buildOutreachEmailDraft({
        prospect,
        contact,
        suppressions,
        step: Array.isArray(sequence?.steps) ? sequence.steps[0] || {} : {},
        variables: variablesFor(prospect, contact, campaign),
        optOutUrl: optOutUrlFor(tokenFor(contact._id, Date.now())),
        senderAddress: mailbox.senderAddress || "Klaus Arent, c/o notamsign.com",
      });

      if (evaluation.eligible === true) {
        eligibleContacts += 1;
      } else {
        blocked[evaluation.reason] = (blocked[evaluation.reason] || 0) + 1;
      }
    }

    return {
      mailbox: {
        fromEmail: mailbox.fromEmail,
        fromName: mailbox.fromName,
        replyTo: mailbox.replyTo,
        status: mailbox.status,
        dailyLimit: mailbox.dailyLimit ?? DEFAULT_DAILY_LIMIT,
      },
      sequenceApproved: Boolean(sequence),
      eligibleContacts,
      blocked,
      messages,
      sentCount: messages.filter((message) => message.status === "sent").length,
      queuedCount: messages.filter((message) => message.status === "queued").length,
      failedCount: messages.filter((message) => message.status === "failed").length,
    };
  },
});

export const queueCampaignFirstStep = mutation({
  args: {
    campaignId: v.id("outreachCampaigns"),
  },
  handler: async (ctx, { campaignId }) => {
    const { campaign, project, workspaceId } = await getCampaignContext(ctx, campaignId);
    await requireProjectAccess(ctx, campaign.projectId);

    const sequences = await ctx.db
      .query("outreachSequences")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();
    const sequence =
      [...sequences].sort((a, b) => b.updatedAt - a.updatedAt).find((item) => item.approvalStatus === "approved") ||
      null;
    const firstStep = Array.isArray(sequence?.steps) ? sequence.steps[0] : undefined;

    if (!sequence || !firstStep) {
      throw new Error("No approved sequence with a first step found");
    }

    const [prospects, contacts, existingMessages] = await Promise.all([
      ctx.db
        .query("outreachProspects")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
        .collect(),
      ctx.db
        .query("outreachContacts")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
        .collect(),
      ctx.db
        .query("outreachMessages")
        .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
        .collect(),
    ]);

    const mailbox = await resolveMailbox(ctx, workspaceId, project._id);
    const suppressions = await getActiveSuppressions(ctx, workspaceId, project._id);
    const prospectById = new Map(prospects.map((prospect) => [prospect._id, prospect]));
    const alreadyQueued = new Set(
      existingMessages
        .filter((message) => message.stepIndex === 0 && message.status !== "cancelled")
        .map((message) => message.contactId)
    );
    const now = Date.now();
    const messageIds: Id<"outreachMessages">[] = [];
    const skipped: Record<string, number> = {};

    for (const contact of contacts) {
      if (alreadyQueued.has(contact._id)) {
        skipped.duplicate = (skipped.duplicate || 0) + 1;
        continue;
      }

      const prospect = prospectById.get(contact.prospectId);
      if (!prospect) continue;

      const optOutToken = tokenFor(contact._id, now);
      const draft = buildOutreachEmailDraft({
        prospect,
        contact,
        suppressions,
        step: firstStep,
        variables: variablesFor(prospect, contact, campaign),
        optOutUrl: optOutUrlFor(optOutToken),
        senderAddress: mailbox.senderAddress || "Klaus Arent, c/o notamsign.com",
      });

      if (draft.eligible === false) {
        skipped[draft.reason] = (skipped[draft.reason] || 0) + 1;
        continue;
      }

      const messageId = await ctx.db.insert("outreachMessages", {
        workspaceId,
        projectId: project._id,
        campaignId,
        prospectId: prospect._id,
        contactId: contact._id,
        sequenceId: sequence._id,
        stepIndex: 0,
        mailboxId: mailbox._id,
        provider: "resend",
        fromEmail: mailbox.fromEmail,
        fromName: mailbox.fromName,
        toEmail: draft.toEmail,
        subject: draft.subject,
        bodyText: draft.body,
        status: "queued",
        optOutToken,
        createdAt: now,
        updatedAt: now,
        ...stripUndefined({
          replyTo: mailbox.replyTo,
        }),
      });

      messageIds.push(messageId);
    }

    return { messageIds, skipped };
  },
});

export const listCampaignMessages = query({
  args: {
    campaignId: v.id("outreachCampaigns"),
  },
  handler: async (ctx, { campaignId }) => {
    const { campaign } = await getCampaignContext(ctx, campaignId);
    await requireProjectAccess(ctx, campaign.projectId);

    return await ctx.db
      .query("outreachMessages")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();
  },
});

export const getMessageForWorker = query({
  args: {
    messageId: v.id("outreachMessages"),
    workerSecret: v.string(),
  },
  handler: async (ctx, { messageId, workerSecret }) => {
    assertWorkerSecret(workerSecret);
    return await ctx.db.get(messageId);
  },
});

export const markMessageSending = mutation({
  args: {
    messageId: v.id("outreachMessages"),
    workerSecret: v.string(),
  },
  handler: async (ctx, { messageId, workerSecret }) => {
    assertWorkerSecret(workerSecret);
    await ctx.db.patch(messageId, {
      status: "sending",
      updatedAt: Date.now(),
    });
  },
});

export const markMessageSent = mutation({
  args: {
    messageId: v.id("outreachMessages"),
    providerMessageId: v.string(),
    workerSecret: v.string(),
  },
  handler: async (ctx, { messageId, providerMessageId, workerSecret }) => {
    assertWorkerSecret(workerSecret);
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");

    const now = Date.now();
    await ctx.db.patch(messageId, {
      status: "sent",
      sentAt: now,
      providerMessageId,
      updatedAt: now,
    });
    await ctx.db.patch(message.prospectId, {
      status: "contacted",
      lastTouchedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("outreachEmailEvents", {
      workspaceId: message.workspaceId,
      projectId: message.projectId,
      campaignId: message.campaignId,
      messageId,
      provider: "resend",
      providerMessageId,
      eventType: "sent",
      recipientEmail: message.toEmail,
      createdAt: now,
    });
  },
});

export const markMessageFailed = mutation({
  args: {
    messageId: v.id("outreachMessages"),
    errorMessage: v.string(),
    workerSecret: v.string(),
  },
  handler: async (ctx, { messageId, errorMessage, workerSecret }) => {
    assertWorkerSecret(workerSecret);
    await ctx.db.patch(messageId, {
      status: "failed",
      errorMessage,
      updatedAt: Date.now(),
    });
  },
});

export const optOutByToken = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    const message = await ctx.runQuery(api.tables.outreachMail.findMessageByOptOutToken, {
      token,
    });
    if (!message) return { success: false };

    const email = normalizeEmail(message.toEmail);
    if (!email) return { success: false };

    await ctx.runMutation(api.tables.outreachMail.createSuppressionFromOptOut, {
      token,
      email,
    });

    return { success: true };
  },
});

export const findMessageByOptOutToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    const messages = await ctx.db.query("outreachMessages").collect();
    return messages.find((message) => message.optOutToken === token) || null;
  },
});

export const createSuppressionFromOptOut = mutation({
  args: {
    token: v.string(),
    email: v.string(),
  },
  handler: async (ctx, { token, email }) => {
    const messages = await ctx.db.query("outreachMessages").collect();
    const message = messages.find((item) => item.optOutToken === token);
    if (!message) throw new Error("Message not found");

    const now = Date.now();
    await ctx.db.insert("outreachSuppressions", {
      workspaceId: message.workspaceId,
      projectId: message.projectId,
      scope: "email",
      value: email,
      reason: "Opt-out",
      source: "opt_out",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("outreachEmailEvents", {
      workspaceId: message.workspaceId,
      projectId: message.projectId,
      campaignId: message.campaignId,
      messageId: message._id,
      provider: "resend",
      providerMessageId: message.providerMessageId,
      eventType: "opted_out",
      recipientEmail: email,
      createdAt: now,
    });
  },
});

export { fromAddress };
