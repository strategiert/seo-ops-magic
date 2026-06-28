# Outreach Core MVP 1A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Outreach Operating System slice: generic outreach campaigns with a Linkbuilding playbook, prospect import, AI strategy/scoring, sequence drafts, manual goal tracking, and dashboard UI.

**Architecture:** Add generic Convex outreach tables and mutations, then layer a Linkbuilding-specific strategy agent on top. The UI exposes project-scoped Outreach pages; Inngest generates strategy/prospect scoring/sequence drafts, while actual email sending, inbox sync, warm-up, and inbox rotation stay out of this slice and become separate infrastructure plans.

**Tech Stack:** React 18, TypeScript, Vite, shadcn/ui, Convex, Inngest, Anthropic SDK, Clerk auth.

---

## Scope Boundary

This plan implements MVP 1A only.

Included:
- Project-scoped Outreach navigation.
- Generic `outreachCampaigns`, `outreachProspects`, `outreachAssets`, `outreachContacts`, `outreachSequences`, `outreachGoals`.
- Linkbuilding-specific `linkPlacements`.
- Campaign creation for `campaignType = "linkbuilding"`.
- Prospect CSV/paste import.
- Manual prospect editing/status tracking.
- AI strategy generation and scoring via Inngest.
- Sequence draft storage and UI editing.
- Manual goal/placement tracking.
- Basic KPI dashboard.

Excluded from this plan:
- Gmail/Microsoft OAuth.
- Actual email sending.
- Inbox sync.
- Warm-up engine.
- Inbox rotation.
- Adaptive sending.
- Automated link verification crawler.

Those excluded pieces are infrastructure-heavy enough to deserve separate plans after this slice works.

## File Structure

Create:
- `convex/tables/outreach.ts` - authenticated CRUD and stats for campaigns, prospects, contacts, sequences, goals.
- `convex/tables/outreachInternal.ts` - internal queries/mutations for Inngest workers.
- `convex/tables/linkBuilding.ts` - authenticated link placement CRUD.
- `convex/agents/outreachActions.ts` - Convex actions callable by Inngest through `ConvexHttpClient`.
- `src/inngest/functions/growth/outreachStrategy.ts` - Linkbuilding strategy/scoring/sequence agent.
- `src/pages/Outreach.tsx` - project Outreach campaign list.
- `src/pages/OutreachCampaignDetail.tsx` - campaign detail workspace.
- `src/components/outreach/CreateCampaignDialog.tsx`
- `src/components/outreach/ProspectImportDialog.tsx`
- `src/components/outreach/SequenceEditor.tsx`
- `src/components/outreach/ProspectStatusBadge.tsx`
- `src/components/outreach/OutreachStats.tsx`

Modify:
- `convex/schema.ts` - add outreach tables.
- `convex/agents/triggers.ts` - add `triggerOutreachStrategy`.
- `src/inngest/lib/convex.ts` - add `outreach-strategy` credit cost.
- `src/inngest/index.ts` - register `outreachStrategy`.
- `src/App.tsx` - add Outreach routes.
- `src/components/layout/AppSidebar.tsx` - add project nav item.

Verification:
- `npx convex codegen`
- `npm run build`
- Manual browser smoke test at `/projects/:projectId/outreach`

---

### Task 1: Add Outreach Schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add outreach tables after `contentAssets` and before utility tables**

Insert this block in `convex/schema.ts` after the `contentAssets` table:

```ts
  // ============ TIER 8: Outreach Operating System ============

  outreachCampaigns: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    campaignType: v.string(), // 'linkbuilding' | 'pr' | 'sales' | 'partnership' | 'seeding'
    targetDomain: v.optional(v.string()),
    targetArticleIds: v.optional(v.array(v.id("articles"))),
    competitors: v.optional(v.array(v.string())),
    goals: v.optional(v.any()),
    strategyJson: v.optional(v.any()),
    status: v.string(), // 'draft' | 'ready' | 'active' | 'paused' | 'review' | 'done'
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_type", ["projectId", "campaignType"])
    .index("by_project_status", ["projectId", "status"]),

  outreachAssets: defineTable({
    projectId: v.id("projects"),
    campaignId: v.id("outreachCampaigns"),
    articleId: v.optional(v.id("articles")),
    assetType: v.string(), // 'article' | 'study' | 'case_study' | 'tool' | 'infographic' | 'landing_page'
    url: v.optional(v.string()),
    title: v.string(),
    pitchAngle: v.optional(v.string()),
    status: v.string(), // 'draft' | 'approved' | 'archived'
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_campaign", ["campaignId"])
    .index("by_article", ["articleId"]),

  outreachProspects: defineTable({
    projectId: v.id("projects"),
    campaignId: v.id("outreachCampaigns"),
    campaignType: v.string(),
    domain: v.string(),
    url: v.optional(v.string()),
    method: v.optional(v.string()),
    score: v.optional(v.number()),
    tier: v.optional(v.string()), // 'A' | 'B' | 'C' | 'D'
    status: v.string(), // 'new' | 'qualified' | 'contacted' | 'replied' | 'won' | 'lost' | 'suppressed'
    reasoning: v.optional(v.string()),
    contactStatus: v.optional(v.string()), // 'missing' | 'found' | 'verified' | 'bad'
    lastTouchedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_campaign", ["campaignId"])
    .index("by_campaign_status", ["campaignId", "status"])
    .index("by_project_domain", ["projectId", "domain"]),

  outreachContacts: defineTable({
    projectId: v.id("projects"),
    prospectId: v.id("outreachProspects"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    email: v.optional(v.string()),
    contactPage: v.optional(v.string()),
    source: v.optional(v.string()),
    suppressed: v.boolean(),
    suppressionReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_prospect", ["prospectId"])
    .index("by_project_email", ["projectId", "email"]),

  outreachSequences: defineTable({
    projectId: v.id("projects"),
    campaignId: v.id("outreachCampaigns"),
    name: v.string(),
    steps: v.array(v.any()),
    variants: v.optional(v.any()),
    approvalStatus: v.string(), // 'draft' | 'approved'
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_campaign", ["campaignId"]),

  outreachGoals: defineTable({
    projectId: v.id("projects"),
    campaignId: v.id("outreachCampaigns"),
    prospectId: v.optional(v.id("outreachProspects")),
    goalType: v.string(), // 'backlink' | 'press_mention' | 'interview' | 'quote' | 'meeting' | 'opportunity' | 'partnership' | 'referral'
    targetUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.string(), // 'open' | 'won' | 'lost' | 'verified'
    verifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_campaign", ["campaignId"])
    .index("by_campaign_status", ["campaignId", "status"]),

  linkPlacements: defineTable({
    projectId: v.id("projects"),
    campaignId: v.id("outreachCampaigns"),
    prospectId: v.optional(v.id("outreachProspects")),
    goalId: v.optional(v.id("outreachGoals")),
    sourceUrl: v.string(),
    targetUrl: v.string(),
    anchorText: v.optional(v.string()),
    rel: v.optional(v.string()),
    firstSeenAt: v.optional(v.number()),
    lastCheckedAt: v.optional(v.number()),
    status: v.string(), // 'live' | 'changed' | 'lost' | 'manual'
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_campaign", ["campaignId"])
    .index("by_goal", ["goalId"]),
```

- [ ] **Step 2: Run Convex codegen**

Run:

```bash
npx convex codegen
```

Expected: generated files in `convex/_generated` update without schema errors.

- [ ] **Step 3: Commit schema**

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat: add outreach data model"
```

---

### Task 2: Add Authenticated Outreach CRUD

**Files:**
- Create: `convex/tables/outreach.ts`
- Test via: `npx convex codegen`

- [ ] **Step 1: Create the module with project access helpers**

Create `convex/tables/outreach.ts`:

```ts
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

async function verifyProjectAccess(ctx: any, projectId: any, userId: string): Promise<boolean> {
  const project = await ctx.db.get(projectId);
  if (!project) return false;

  const workspace = await ctx.db.get(project.workspaceId);
  if (!workspace) return false;

  return workspace.ownerId === userId;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter((entry) => entry[1] !== undefined));
}

export const listCampaigns = query({
  args: {
    projectId: v.id("projects"),
    campaignType: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, campaignType }) => {
    const userId = await requireAuth(ctx);
    if (!(await verifyProjectAccess(ctx, projectId, userId))) return [];

    if (campaignType) {
      return await ctx.db
        .query("outreachCampaigns")
        .withIndex("by_project_type", (q) => q.eq("projectId", projectId).eq("campaignType", campaignType))
        .collect();
    }

    return await ctx.db
      .query("outreachCampaigns")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const getCampaignBundle = query({
  args: { campaignId: v.id("outreachCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const userId = await requireAuth(ctx);
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) return null;
    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) return null;

    const [assets, prospects, sequences, goals] = await Promise.all([
      ctx.db.query("outreachAssets").withIndex("by_campaign", (q) => q.eq("campaignId", campaignId)).collect(),
      ctx.db.query("outreachProspects").withIndex("by_campaign", (q) => q.eq("campaignId", campaignId)).collect(),
      ctx.db.query("outreachSequences").withIndex("by_campaign", (q) => q.eq("campaignId", campaignId)).collect(),
      ctx.db.query("outreachGoals").withIndex("by_campaign", (q) => q.eq("campaignId", campaignId)).collect(),
    ]);

    return { campaign, assets, prospects, sequences, goals };
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
    goals: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (!(await verifyProjectAccess(ctx, args.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    const now = Date.now();
    return await ctx.db.insert("outreachCampaigns", {
      projectId: args.projectId,
      name: args.name,
      campaignType: args.campaignType,
      targetDomain: args.targetDomain,
      targetArticleIds: args.targetArticleIds,
      competitors: args.competitors,
      goals: args.goals,
      status: "draft",
      createdAt: now,
      updatedAt: now,
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
    goals: v.optional(v.any()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { campaignId, ...updates }) => {
    const userId = await requireAuth(ctx);
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    await ctx.db.patch(campaignId, {
      ...stripUndefined(updates),
      updatedAt: Date.now(),
    });

    return campaignId;
  },
});
```

- [ ] **Step 2: Add prospect import and updates to the same file**

Append:

```ts
export const createProspectsBatch = mutation({
  args: {
    campaignId: v.id("outreachCampaigns"),
    prospects: v.array(v.object({
      domain: v.string(),
      url: v.optional(v.string()),
      method: v.optional(v.string()),
      contactEmail: v.optional(v.string()),
      contactName: v.optional(v.string()),
      contactPage: v.optional(v.string()),
      reasoning: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { campaignId, prospects }) => {
    const userId = await requireAuth(ctx);
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    const now = Date.now();
    const inserted: string[] = [];

    for (const prospect of prospects) {
      const prospectId = await ctx.db.insert("outreachProspects", {
        projectId: campaign.projectId,
        campaignId,
        campaignType: campaign.campaignType,
        domain: prospect.domain,
        url: prospect.url,
        method: prospect.method,
        status: "new",
        reasoning: prospect.reasoning,
        contactStatus: prospect.contactEmail || prospect.contactPage ? "found" : "missing",
        createdAt: now,
        updatedAt: now,
      });

      inserted.push(prospectId);

      if (prospect.contactEmail || prospect.contactName || prospect.contactPage) {
        await ctx.db.insert("outreachContacts", {
          projectId: campaign.projectId,
          prospectId,
          name: prospect.contactName,
          email: prospect.contactEmail,
          contactPage: prospect.contactPage,
          source: "import",
          suppressed: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return inserted;
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
    if (!prospect) throw new Error("Prospect not found");
    if (!(await verifyProjectAccess(ctx, prospect.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    await ctx.db.patch(prospectId, {
      ...stripUndefined(updates),
      lastTouchedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return prospectId;
  },
});
```

- [ ] **Step 3: Add sequences, goals, and stats**

Append:

```ts
export const upsertSequence = mutation({
  args: {
    campaignId: v.id("outreachCampaigns"),
    sequenceId: v.optional(v.id("outreachSequences")),
    name: v.string(),
    steps: v.array(v.any()),
    variants: v.optional(v.any()),
    approvalStatus: v.string(),
  },
  handler: async (ctx, { campaignId, sequenceId, ...data }) => {
    const userId = await requireAuth(ctx);
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    const now = Date.now();

    if (sequenceId) {
      await ctx.db.patch(sequenceId, { ...data, updatedAt: now });
      return sequenceId;
    }

    return await ctx.db.insert("outreachSequences", {
      projectId: campaign.projectId,
      campaignId,
      ...data,
      createdAt: now,
      updatedAt: now,
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
    if (!campaign) throw new Error("Campaign not found");
    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    const now = Date.now();
    return await ctx.db.insert("outreachGoals", {
      projectId: campaign.projectId,
      campaignId: args.campaignId,
      prospectId: args.prospectId,
      goalType: args.goalType,
      targetUrl: args.targetUrl,
      sourceUrl: args.sourceUrl,
      description: args.description,
      status: args.status ?? "open",
      verifiedAt: args.status === "verified" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const prospectStats = query({
  args: { campaignId: v.id("outreachCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const userId = await requireAuth(ctx);
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) return null;
    if (!(await verifyProjectAccess(ctx, campaign.projectId, userId))) return null;

    const prospects = await ctx.db
      .query("outreachProspects")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();

    const goals = await ctx.db
      .query("outreachGoals")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();

    const byStatus = prospects.reduce<Record<string, number>>((acc, prospect) => {
      acc[prospect.status] = (acc[prospect.status] || 0) + 1;
      return acc;
    }, {});

    const byTier = prospects.reduce<Record<string, number>>((acc, prospect) => {
      const tier = prospect.tier || "unscored";
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {});

    return {
      totalProspects: prospects.length,
      byStatus,
      byTier,
      wonGoals: goals.filter((goal) => goal.status === "won" || goal.status === "verified").length,
      openGoals: goals.filter((goal) => goal.status === "open").length,
    };
  },
});
```

- [ ] **Step 4: Verify Convex compile**

Run:

```bash
npx convex codegen
```

Expected: no TypeScript or Convex validator errors.

- [ ] **Step 5: Commit CRUD module**

```bash
git add convex/tables/outreach.ts convex/_generated
git commit -m "feat: add outreach campaign mutations"
```

---

### Task 3: Add Internal Outreach Functions for Agents

**Files:**
- Create: `convex/tables/outreachInternal.ts`
- Create: `convex/agents/outreachActions.ts`

- [ ] **Step 1: Create internal query/mutation module**

Create `convex/tables/outreachInternal.ts`:

```ts
import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const getCampaignContext = internalQuery({
  args: { campaignId: v.id("outreachCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) return null;

    const project = await ctx.db.get(campaign.projectId);
    const workspace = project ? await ctx.db.get(project.workspaceId) : null;
    const brandProfile = await ctx.db
      .query("brandProfiles")
      .withIndex("by_project", (q) => q.eq("projectId", campaign.projectId))
      .first();

    const articles = await Promise.all(
      (campaign.targetArticleIds || []).map((articleId) => ctx.db.get(articleId))
    );

    const prospects = await ctx.db
      .query("outreachProspects")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();

    return {
      campaign,
      project,
      workspace,
      brandProfile,
      articles: articles.filter(Boolean),
      prospects,
    };
  },
});

export const saveStrategyOutput = internalMutation({
  args: {
    campaignId: v.id("outreachCampaigns"),
    strategyJson: v.any(),
    prospects: v.array(v.object({
      domain: v.string(),
      url: v.optional(v.string()),
      method: v.optional(v.string()),
      score: v.optional(v.number()),
      tier: v.optional(v.string()),
      reasoning: v.optional(v.string()),
      contactEmail: v.optional(v.string()),
      contactName: v.optional(v.string()),
      contactPage: v.optional(v.string()),
    })),
    sequence: v.object({
      name: v.string(),
      steps: v.array(v.any()),
      variants: v.optional(v.any()),
    }),
  },
  handler: async (ctx, { campaignId, strategyJson, prospects, sequence }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) throw new Error("Campaign not found");

    const now = Date.now();

    await ctx.db.patch(campaignId, {
      strategyJson,
      status: "ready",
      updatedAt: now,
    });

    const existing = await ctx.db
      .query("outreachProspects")
      .withIndex("by_campaign", (q) => q.eq("campaignId", campaignId))
      .collect();
    const existingDomains = new Set(existing.map((item) => item.domain.toLowerCase()));

    const insertedProspectIds: string[] = [];

    for (const prospect of prospects) {
      if (existingDomains.has(prospect.domain.toLowerCase())) continue;

      const prospectId = await ctx.db.insert("outreachProspects", {
        projectId: campaign.projectId,
        campaignId,
        campaignType: campaign.campaignType,
        domain: prospect.domain,
        url: prospect.url,
        method: prospect.method,
        score: prospect.score,
        tier: prospect.tier,
        status: prospect.score !== undefined ? "qualified" : "new",
        reasoning: prospect.reasoning,
        contactStatus: prospect.contactEmail || prospect.contactPage ? "found" : "missing",
        createdAt: now,
        updatedAt: now,
      });

      insertedProspectIds.push(prospectId);

      if (prospect.contactEmail || prospect.contactName || prospect.contactPage) {
        await ctx.db.insert("outreachContacts", {
          projectId: campaign.projectId,
          prospectId,
          name: prospect.contactName,
          email: prospect.contactEmail,
          contactPage: prospect.contactPage,
          source: "ai_strategy",
          suppressed: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const sequenceId = await ctx.db.insert("outreachSequences", {
      projectId: campaign.projectId,
      campaignId,
      name: sequence.name,
      steps: sequence.steps,
      variants: sequence.variants,
      approvalStatus: "draft",
      createdAt: now,
      updatedAt: now,
    });

    return { insertedProspectIds, sequenceId };
  },
});
```

- [ ] **Step 2: Create HTTP-callable wrappers for Inngest**

Create `convex/agents/outreachActions.ts`:

```ts
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export const getCampaignContext = action({
  args: { campaignId: v.string() },
  handler: async (ctx, { campaignId }) => {
    return await ctx.runQuery(internal.tables.outreachInternal.getCampaignContext, {
      campaignId: campaignId as Id<"outreachCampaigns">,
    });
  },
});

export const saveStrategyOutput = action({
  args: {
    campaignId: v.string(),
    strategyJson: v.any(),
    prospects: v.array(v.object({
      domain: v.string(),
      url: v.optional(v.string()),
      method: v.optional(v.string()),
      score: v.optional(v.number()),
      tier: v.optional(v.string()),
      reasoning: v.optional(v.string()),
      contactEmail: v.optional(v.string()),
      contactName: v.optional(v.string()),
      contactPage: v.optional(v.string()),
    })),
    sequence: v.object({
      name: v.string(),
      steps: v.array(v.any()),
      variants: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(internal.tables.outreachInternal.saveStrategyOutput, {
      campaignId: args.campaignId as Id<"outreachCampaigns">,
      strategyJson: args.strategyJson,
      prospects: args.prospects,
      sequence: args.sequence,
    });
  },
});
```

- [ ] **Step 3: Verify generated API paths**

Run:

```bash
npx convex codegen
```

Expected generated references:
- `api.agents.outreachActions.getCampaignContext`
- `api.agents.outreachActions.saveStrategyOutput`
- `internal.tables.outreachInternal.getCampaignContext`
- `internal.tables.outreachInternal.saveStrategyOutput`

- [ ] **Step 4: Commit internal agent functions**

```bash
git add convex/tables/outreachInternal.ts convex/agents/outreachActions.ts convex/_generated
git commit -m "feat: add outreach agent persistence"
```

---

### Task 4: Add Outreach Strategy Trigger

**Files:**
- Modify: `convex/agents/triggers.ts`
- Modify: `src/inngest/lib/convex.ts`

- [ ] **Step 1: Add agent cost constant in both places**

In `convex/agents/triggers.ts`, add:

```ts
  "outreach-strategy": 4,
```

to `AGENT_CREDITS`.

In `src/inngest/lib/convex.ts`, add:

```ts
  "outreach-strategy": 4,
```

to `AGENT_CREDITS`.

- [ ] **Step 2: Add event mapping**

In `convex/agents/triggers.ts`, add:

```ts
  "outreach-strategy": "outreach/strategy",
```

to `AGENT_EVENTS`.

- [ ] **Step 3: Add trigger action**

Append this action before the job status queries in `convex/agents/triggers.ts`:

```ts
export const triggerOutreachStrategy = action({
  args: {
    campaignId: v.id("outreachCampaigns"),
  },
  handler: async (ctx, { campaignId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const campaign = await ctx.runQuery(internal.tables.outreachInternal.getCampaignContext, {
      campaignId,
    });

    if (!campaign?.campaign) {
      throw new Error("Campaign not found");
    }

    const project = campaign.project;
    if (!project) {
      throw new Error("Project not found");
    }

    if (!campaign.workspace || campaign.workspace.ownerId !== identity.subject) {
      throw new Error("Unauthorized: No access to this campaign");
    }

    const agentId = "outreach-strategy";
    const requiredCredits = AGENT_CREDITS[agentId];
    const workspaceId = project.workspaceId;

    const eventKey = process.env.INNGEST_EVENT_KEY;
    if (!eventKey) {
      throw new Error("INNGEST_EVENT_KEY not configured");
    }

    const eventResult = await sendInngestEvent(
      AGENT_EVENTS[agentId],
      {
        campaignId,
        projectId: campaign.campaign.projectId,
        userId: identity.subject,
        customerId: workspaceId,
        workspaceId,
      },
      eventKey
    );

    if (!eventResult.success) {
      return { success: false, error: eventResult.error };
    }

    return {
      success: true,
      eventId: eventResult.eventId,
      message: "Outreach strategy generation started",
      creditsReserved: requiredCredits,
    };
  },
});
```

Note: This new trigger lets Inngest reserve credits, avoiding double-charging in the new Outreach path.

- [ ] **Step 4: Verify TypeScript**

Run:

```bash
npx convex codegen
npm run build
```

Expected: build completes. If `project.workspaceId` is missing from the returned `project`, patch `outreachInternal.getCampaignContext` to return the full project document.

- [ ] **Step 5: Commit trigger**

```bash
git add convex/agents/triggers.ts src/inngest/lib/convex.ts convex/_generated
git commit -m "feat: trigger outreach strategy agent"
```

---

### Task 5: Add Linkbuilding Strategy Agent

**Files:**
- Create: `src/inngest/functions/growth/outreachStrategy.ts`
- Modify: `src/inngest/index.ts`

- [ ] **Step 1: Create the Inngest function**

Create `src/inngest/functions/growth/outreachStrategy.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { inngest } from "../../client";
import { api, convex, AGENT_CREDITS, calculateCostCents } from "../../lib/convex";

const AGENT_ID = "outreach-strategy";
const CREDITS_REQUIRED = AGENT_CREDITS[AGENT_ID];

const SYSTEM_PROMPT = `Du bist der Outreach Strategy Agent fuer SEO Ops Magic.

Du erstellst Outreach-Kampagnen fuer unterschiedliche Kampagnentypen. In dieser Version ist nur campaignType="linkbuilding" aktiv.

Fuer Linkbuilding:
- Priorisiere thematische Relevanz, Linkwahrscheinlichkeit und natuerliche Outreach-Argumente.
- Nutze Methoden wie Resource Page Outreach, Broken Link Building, Guest Posting, Competitor Replication, Unlinked Mentions, Expert Quote Outreach, Partner Links und Linkbait Promotion.
- Scoring: Relevanz 30%, Domain-/Seitenqualitaet 25%, Linkwahrscheinlichkeit 20%, Kontaktierbarkeit 15%, Aufwand 10%.
- Tier A = 0.8-1.0, B = 0.6-0.79, C = 0.4-0.59, D = unter 0.4.
- Schreibe auf Deutsch, klar, professionell und konkret.

Antworte ausschliesslich als gueltiges JSON:
{
  "strategy": {
    "summary": "string",
    "positioning": "string",
    "recommendedMethods": ["string"],
    "searchOperators": ["string"],
    "risks": ["string"],
    "nextActions": ["string"]
  },
  "prospects": [
    {
      "domain": "example.com",
      "url": "https://example.com/resources",
      "method": "resource_page",
      "score": 0.82,
      "tier": "A",
      "reasoning": "Warum diese Chance sinnvoll ist",
      "contactEmail": "optional@example.com",
      "contactName": "Optional Name",
      "contactPage": "https://example.com/contact"
    }
  ],
  "sequence": {
    "name": "Linkbuilding Outreach",
    "steps": [
      {
        "dayOffset": 0,
        "subject": "Kurzer Hinweis zu {{siteName}}",
        "body": "Plain text Mail mit Variablen."
      },
      {
        "dayOffset": 4,
        "subject": "Re: Kurzer Hinweis zu {{siteName}}",
        "body": "Plain text Follow-up."
      }
    ],
    "variants": {
      "resource_page": "Hinweis fuer Resource Pages",
      "broken_link": "Hinweis fuer Broken Link Outreach"
    }
  }
}`;

function parseJsonObject(text: string): any {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON response");
  }
  return JSON.parse(jsonMatch[0]);
}

export const outreachStrategy = inngest.createFunction(
  {
    id: "outreach-strategy",
    name: "Outreach Strategy",
    concurrency: {
      limit: 3,
      key: "event.data.customerId",
    },
    retries: 2,
  },
  { event: "outreach/strategy" },
  async ({ event, step }) => {
    const { campaignId, projectId, userId, workspaceId } = event.data as {
      campaignId: string;
      projectId: string;
      userId: string;
      workspaceId: string;
      customerId: string;
    };

    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    await step.run("check-credits", async () => {
      const result = await convex.action(api.agents.actions.checkAndReserveCredits, {
        workspaceId,
        agentId: AGENT_ID,
        requiredCredits: CREDITS_REQUIRED,
      });

      if (!result.success) {
        throw new Error(result.error || "Credit check failed");
      }
    });

    await step.run("create-job-record", async () => {
      await convex.action(api.agents.actions.createAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        userId,
        workspaceId,
        projectId,
        agentId: AGENT_ID,
        eventType: "outreach/strategy",
        inputData: { campaignId },
        creditsReserved: CREDITS_REQUIRED,
      });
    });

    const context = await step.run("fetch-campaign-context", async () => {
      const result = await convex.action(api.agents.outreachActions.getCampaignContext, {
        campaignId,
      });

      if (!result?.campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        status: "running",
        currentStep: "Fetching campaign context",
        progress: 15,
      });

      return result;
    });

    const generated = await step.run("generate-strategy", async () => {
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        currentStep: "Generating outreach strategy",
        progress: 35,
      });

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const campaign = context.campaign;
      const articleSummary = (context.articles || [])
        .map((article: any) => `- ${article.title}: ${article.primaryKeyword || "kein Keyword"}\n${(article.metaDescription || article.contentMarkdown || "").slice(0, 500)}`)
        .join("\n\n");

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 5000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Erstelle eine Outreach-Strategie fuer diese Kampagne.

Kampagne:
${JSON.stringify(campaign, null, 2)}

Projekt:
${JSON.stringify(context.project, null, 2)}

Brand-Kontext:
${JSON.stringify(context.brandProfile, null, 2).slice(0, 4000)}

Zielartikel:
${articleSummary || "Keine Zielartikel ausgewaehlt."}

Bereits importierte Prospects:
${JSON.stringify(context.prospects || [], null, 2).slice(0, 5000)}

Gib nur JSON im geforderten Format zurueck.`,
          },
        ],
      });

      inputTokens = response.usage.input_tokens;
      outputTokens = response.usage.output_tokens;

      const textContent = response.content.find((item) => item.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response from Anthropic");
      }

      return parseJsonObject(textContent.text);
    });

    const saved = await step.run("save-strategy", async () => {
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        currentStep: "Saving strategy",
        progress: 80,
      });

      return await convex.action(api.agents.outreachActions.saveStrategyOutput, {
        campaignId,
        strategyJson: generated.strategy,
        prospects: generated.prospects || [],
        sequence: generated.sequence,
      });
    });

    const durationMs = Date.now() - startTime;

    await step.run("log-usage", async () => {
      await convex.action(api.agents.actions.logUsage, {
        userId,
        workspaceId,
        projectId,
        agentId: AGENT_ID,
        jobId: event.id,
        creditsUsed: CREDITS_REQUIRED,
        inputTokens,
        outputTokens,
        status: "completed",
        durationMs,
      });

      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        status: "completed",
        progress: 100,
        currentStep: "Done",
        creditsUsed: CREDITS_REQUIRED,
        result: {
          campaignId,
          prospectsCreated: saved.insertedProspectIds.length,
          sequenceId: saved.sequenceId,
        },
      });
    });

    return {
      success: true,
      campaignId,
      prospectsCreated: saved.insertedProspectIds.length,
      sequenceId: saved.sequenceId,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostCents: calculateCostCents(inputTokens, outputTokens),
      },
    };
  }
);
```

- [ ] **Step 2: Register the function**

Modify `src/inngest/index.ts`:

```ts
export { outreachStrategy } from "./functions/growth/outreachStrategy";
```

Add import:

```ts
import { outreachStrategy } from "./functions/growth/outreachStrategy";
```

Add to `allAgentFunctions`:

```ts
  outreachStrategy,
```

- [ ] **Step 3: Verify build**

Run:

```bash
npm run build
```

Expected: TypeScript build succeeds.

- [ ] **Step 4: Commit agent**

```bash
git add src/inngest/functions/growth/outreachStrategy.ts src/inngest/index.ts
git commit -m "feat: add outreach strategy agent"
```

---

### Task 6: Build Outreach Campaign List UI

**Files:**
- Create: `src/components/outreach/CreateCampaignDialog.tsx`
- Create: `src/pages/Outreach.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Create campaign dialog**

Create `src/components/outreach/CreateCampaignDialog.tsx` with fields:
- `name`
- `targetDomain`
- `competitors` textarea, one domain per line
- `goals` textarea

Use `api.tables.outreach.createCampaign` and hard-code `campaignType: "linkbuilding"` for MVP 1A.

Acceptance:
- Empty name disables submit.
- Submit returns created campaign ID.
- Competitors are split by newline, trimmed, and empty lines removed.

- [ ] **Step 2: Create Outreach page**

Create `src/pages/Outreach.tsx`:
- Uses `useWorkspaceConvex()` to get `currentProject`.
- Uses `api.tables.outreach.listCampaigns`.
- Shows dense dashboard layout, not a landing page.
- Shows empty state with create button.
- Table columns: Name, Typ, Domain, Status, Prospects target, Updated.
- Row click navigates to `/projects/:projectId/outreach/:campaignId`.

Use existing UI imports from `Articles.tsx` as the style reference.

- [ ] **Step 3: Add routes**

Modify `src/App.tsx`:

```ts
import Outreach from "./pages/Outreach";
import OutreachCampaignDetail from "./pages/OutreachCampaignDetail";
```

Add routes inside the project-scoped tree:

```tsx
<Route path="/projects/:projectId/outreach" element={<P><Outreach /></P>} />
<Route path="/projects/:projectId/outreach/:campaignId" element={<P><OutreachCampaignDetail /></P>} />
```

- [ ] **Step 4: Add sidebar item**

Modify `src/components/layout/AppSidebar.tsx`:
- Import `Send` from `lucide-react`.
- Add project nav item after `Artikel`:

```ts
{ title: 'Outreach', url: `${projectPrefix}/outreach`, icon: Send },
```

- [ ] **Step 5: Verify build**

Run:

```bash
npm run build
```

Expected: fails only if `OutreachCampaignDetail` is not created yet. If so, create a temporary page exporting a simple `AppLayout` shell with heading `Outreach-Kampagne`, then continue to Task 7.

- [ ] **Step 6: Commit list UI**

```bash
git add src/components/outreach/CreateCampaignDialog.tsx src/pages/Outreach.tsx src/App.tsx src/components/layout/AppSidebar.tsx
git commit -m "feat: add outreach campaign workspace"
```

---

### Task 7: Build Campaign Detail UI

**Files:**
- Create: `src/pages/OutreachCampaignDetail.tsx`
- Create: `src/components/outreach/ProspectStatusBadge.tsx`
- Create: `src/components/outreach/OutreachStats.tsx`

- [ ] **Step 1: Create status badge helper**

Create `src/components/outreach/ProspectStatusBadge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, string> = {
  new: "Neu",
  qualified: "Qualifiziert",
  contacted: "Kontaktiert",
  replied: "Antwort",
  won: "Gewonnen",
  lost: "Verloren",
  suppressed: "Gesperrt",
};

const statusClasses: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  qualified: "bg-blue-500/20 text-blue-700",
  contacted: "bg-yellow-500/20 text-yellow-700",
  replied: "bg-orange-500/20 text-orange-700",
  won: "bg-green-500/20 text-green-700",
  lost: "bg-red-500/20 text-red-700",
  suppressed: "bg-zinc-500/20 text-zinc-700",
};

export function ProspectStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={statusClasses[status] || statusClasses.new}>
      {statusLabels[status] || status}
    </Badge>
  );
}
```

- [ ] **Step 2: Create stats component**

Create `src/components/outreach/OutreachStats.tsx`:
- Props: `{ stats: { totalProspects: number; byStatus: Record<string, number>; byTier: Record<string, number>; wonGoals: number; openGoals: number } | null }`
- Render five compact metric blocks: Prospects, Tier A/B, Antworten, Ziele offen, Ziele gewonnen.
- Use restrained dashboard styling with `border rounded-lg p-4`.

- [ ] **Step 3: Create campaign detail page**

Create `src/pages/OutreachCampaignDetail.tsx`:
- Read `campaignId` from `useParams`.
- Use `api.tables.outreach.getCampaignBundle`.
- Use `api.tables.outreach.prospectStats`.
- Use `api.agents.triggers.triggerOutreachStrategy`.
- Render tabs: `Strategie`, `Prospects`, `Sequenz`, `Ziele`.
- `Strategie` tab shows `campaign.strategyJson` if present and a button `Strategie generieren`.
- `Prospects` tab shows table with domain, URL, method, score, tier, status, reasoning.
- `Sequenz` tab renders `SequenceEditor`.
- `Ziele` tab lists goals and a small manual create form.

Acceptance:
- Loading state appears while Convex query is undefined.
- Missing campaign shows `Kampagne nicht gefunden`.
- Strategy button is disabled while action is pending.
- A success toast shows the returned event ID.

- [ ] **Step 4: Verify build**

Run:

```bash
npm run build
```

Expected: build succeeds if `SequenceEditor` exists. If it does not exist yet, create the component in Task 8 before re-running.

- [ ] **Step 5: Commit detail UI**

```bash
git add src/pages/OutreachCampaignDetail.tsx src/components/outreach/ProspectStatusBadge.tsx src/components/outreach/OutreachStats.tsx
git commit -m "feat: add outreach campaign detail"
```

---

### Task 8: Add Prospect Import and Sequence Editing

**Files:**
- Create: `src/components/outreach/ProspectImportDialog.tsx`
- Create: `src/components/outreach/SequenceEditor.tsx`
- Modify: `src/pages/OutreachCampaignDetail.tsx`

- [ ] **Step 1: Create import parser**

Inside `ProspectImportDialog.tsx`, implement this parser:

```ts
type ParsedProspect = {
  domain: string;
  url?: string;
  method?: string;
  contactEmail?: string;
  contactName?: string;
  contactPage?: string;
};

function parseProspectRows(input: string): ParsedProspect[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,\t;]/).map((part) => part.trim()).filter(Boolean);
      const first = parts[0] || "";
      const url = first.startsWith("http") ? first : undefined;
      const domain = url
        ? new URL(url).hostname.replace(/^www\./, "")
        : first.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

      return {
        domain,
        url,
        contactEmail: parts.find((part) => part.includes("@")),
        method: parts.find((part) => ["resource_page", "broken_link", "guest_post", "competitor_replication", "unlinked_mention"].includes(part)),
      };
    })
    .filter((prospect) => prospect.domain.length > 0);
}
```

The component uses `api.tables.outreach.createProspectsBatch`.

- [ ] **Step 2: Create sequence editor**

Create `src/components/outreach/SequenceEditor.tsx`:
- Props: `campaignId`, `sequence`.
- Local editable state for name and steps.
- Each step has `dayOffset`, `subject`, `body`.
- Button `Schritt hinzufuegen`.
- Save calls `api.tables.outreach.upsertSequence`.
- Approve toggle sets `approvalStatus` to `approved`.

Default step when no sequence exists:

```ts
{
  dayOffset: 0,
  subject: "Kurzer Hinweis zu {{siteName}}",
  body: "Hallo {{firstName}},\n\nich bin auf {{siteName}} gestossen und dachte, unsere Ressource zu {{topic}} koennte fuer Ihre Leser hilfreich sein.\n\nViele Gruesse\n{{senderName}}"
}
```

- [ ] **Step 3: Wire components into campaign detail**

In `OutreachCampaignDetail.tsx`:
- Add `ProspectImportDialog` button in `Prospects` tab.
- Add `SequenceEditor` in `Sequenz` tab.
- Refetch is automatic through Convex reactive queries.

- [ ] **Step 4: Verify build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit import/editor**

```bash
git add src/components/outreach/ProspectImportDialog.tsx src/components/outreach/SequenceEditor.tsx src/pages/OutreachCampaignDetail.tsx
git commit -m "feat: add prospect import and sequence editor"
```

---

### Task 9: Add Link Placement CRUD

**Files:**
- Create: `convex/tables/linkBuilding.ts`
- Modify: `src/pages/OutreachCampaignDetail.tsx`

- [ ] **Step 1: Create placement module**

Create `convex/tables/linkBuilding.ts`:

```ts
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

async function verifyProjectAccess(ctx: any, projectId: any, userId: string): Promise<boolean> {
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
```

- [ ] **Step 2: Add placements to Ziele tab**

In `OutreachCampaignDetail.tsx`:
- Use `api.tables.linkBuilding.listPlacements`.
- Add form fields: source URL, target URL, anchor text, rel.
- Save calls `api.tables.linkBuilding.createPlacement`.
- Show placements below goals.

- [ ] **Step 3: Verify**

Run:

```bash
npx convex codegen
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit placements**

```bash
git add convex/tables/linkBuilding.ts src/pages/OutreachCampaignDetail.tsx convex/_generated
git commit -m "feat: track link placements"
```

---

### Task 10: Final Verification

**Files:**
- All files from previous tasks.

- [ ] **Step 1: Run full build**

Run:

```bash
npm run build
```

Expected: Vite build completes with no TypeScript errors.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: no new lint errors in files touched by this plan. If the repo has pre-existing lint errors, capture them and verify none are from Outreach files.

- [ ] **Step 3: Manual smoke test**

Start dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:5173/projects/<projectId>/outreach
```

Smoke steps:
- Create a Linkbuilding campaign.
- Open campaign detail.
- Import three prospects via paste:

```text
https://example.com/resources,resource_page,editor@example.com
https://example.org/blog,guest_post
partner-site.de
```

- Confirm prospects appear.
- Click `Strategie generieren`.
- Confirm job starts and the campaign later shows strategy JSON, scored prospects, and a draft sequence.
- Edit and save the sequence.
- Add a manual backlink goal.
- Add a manual placement.

- [ ] **Step 4: Commit final fixes**

```bash
git add .
git commit -m "fix: polish outreach mvp smoke test"
```

Only run this commit if Step 3 required fixes. If no fixes were needed, skip this step.

---

## Follow-Up Plans

After this plan is implemented and verified, create separate plans in this order:

1. `outreach-mailbox-mvp1b` - Gmail OAuth, mailbox table hardening, test mail, sending queue.
2. `outreach-inbox-mvp1c` - inbox sync, reply matching, reply classification, action queue.
3. `outreach-deliverability-mvp2` - warm-up, inbox rotation, SPF/DKIM/DMARC checks, adaptive sending.
4. `outreach-discovery-mvp3` - crawler, SERP provider abstraction, contact enrichment, unlinked mentions.
5. `outreach-playbooks-mvp4` - PR, Sales, Partnership and Seeding playbooks.

## Self-Review

Spec coverage:
- Generic Outreach Core is represented by generic table names and UI routes.
- Linkbuilding is first playbook, not hard-coded as the whole product.
- Woodpecker-like sending, warm-up, inbox sync and rotation are explicitly deferred to separate infrastructure plans.
- The first slice produces working software without external paid tools.

Placeholder scan:
- No placeholder markers or deferred-work filler entries.
- Each task names exact files and verification commands.

Type consistency:
- `campaignId` consistently references `outreachCampaigns`.
- `campaignType` stays a string in schema and MVP UI uses `linkbuilding`.
- Agent ID is consistently `outreach-strategy`.
- Inngest event is consistently `outreach/strategy`.
