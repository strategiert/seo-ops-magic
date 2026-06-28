# Outreach Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-first Outreach start flow that analyzes existing project data, sitemap URLs, and content assets to recommend linkbait opportunities and create a generated outreach campaign.

**Architecture:** Add a project-scoped `outreachAnalyses` table and authenticated queries/actions. A new Inngest `outreach-intelligence` function gathers internal context plus live sitemap URLs, asks Claude for structured opportunity scoring, stores the analysis, and creates one generated campaign. The Outreach page becomes an AI workbench with the old manual campaign dialog as secondary fallback.

**Tech Stack:** React 18, TypeScript, Vite, shadcn/ui, Convex, Inngest, Anthropic SDK, Clerk auth.

---

## File Structure

Create:
- `convex/tables/outreachIntelligence.ts` - authenticated queries/mutations and internal context/save functions for analysis runs.
- `convex/agents/outreachIntelligenceActions.ts` - secured Convex actions callable by Inngest workers.
- `src/inngest/functions/growth/outreachIntelligence.ts` - AI agent that builds project context, fetches sitemap URLs, scores linkbait opportunities, stores analysis, and creates a generated campaign.
- `src/components/outreach/OutreachIntelligencePanel.tsx` - AI-first panel for running and reading the latest analysis.

Modify:
- `convex/schema.ts` - add `outreachAnalyses`.
- `convex/agents/triggers.ts` - add `triggerOutreachIntelligence`.
- `convex/tables/credits.ts` - enable `outreach-intelligence`.
- `src/inngest/lib/convex.ts` - add credit cost.
- `src/inngest/index.ts` - export/register function.
- `api/inngest.ts` - register function in live Vercel endpoint.
- `src/pages/Outreach.tsx` - replace form-first layout with AI workbench.

## Task 1: Add Analysis Persistence

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/tables/outreachIntelligence.ts`

- [ ] **Step 1: Add `outreachAnalyses` table**

Insert after `outreachCampaigns`:

```ts
  outreachAnalyses: defineTable({
    projectId: v.id("projects"),
    status: v.string(),
    summary: v.optional(v.string()),
    sourceCoverageJson: v.optional(v.any()),
    opportunitiesJson: v.optional(v.any()),
    recommendedCampaignJson: v.optional(v.any()),
    createdCampaignId: v.optional(v.id("outreachCampaigns")),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"]),
```

- [ ] **Step 2: Create public/internal analysis module**

Create `convex/tables/outreachIntelligence.ts` with:

```ts
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

async function verifyProjectAccess(ctx: any, projectId: any, userId: string): Promise<boolean> {
  const project = await ctx.db.get(projectId);
  if (!project) return false;
  const workspace = await ctx.db.get(project.workspaceId);
  return workspace?.ownerId === userId;
}

function excerpt(value: string | undefined, max = 1200): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function jsonPreview(value: unknown, max = 1200): string {
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value).slice(0, max);
  } catch {
    return String(value).slice(0, max);
  }
}

export const latestByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await requireAuth(ctx);
    if (!(await verifyProjectAccess(ctx, projectId, userId))) return null;
    const runs = await ctx.db
      .query("outreachAnalyses")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return runs.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  },
});

export const createRunning = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const now = Date.now();
    return await ctx.db.insert("outreachAnalyses", {
      projectId,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getContext = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get(projectId);
    if (!project) return null;
    const workspace = await ctx.db.get(project.workspaceId);
    const brandProfile = await ctx.db
      .query("brandProfiles")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    const crawlPages = brandProfile
      ? await ctx.db
          .query("brandCrawlData")
          .withIndex("by_brand_profile", (q) => q.eq("brandProfileId", brandProfile._id))
          .collect()
      : [];
    const articles = await ctx.db.query("articles").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    const briefs = await ctx.db.query("contentBriefs").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    const htmlExports = await ctx.db.query("htmlExports").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    const contentAssets = await ctx.db.query("contentAssets").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    const integrations = await ctx.db.query("integrations").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect();
    const gscConnection = await ctx.db.query("gscConnections").withIndex("by_project", (q) => q.eq("projectId", projectId)).first();
    const dashboardPages = await ctx.db.query("bodycamPages").collect();

    return {
      project,
      workspace,
      brandProfile,
      crawlPages: crawlPages
        .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
        .slice(0, 40)
        .map((page) => ({
          id: page._id,
          url: page.url,
          title: page.title,
          pageType: page.pageType,
          metaDescription: page.metaDescription,
          relevanceScore: page.relevanceScore,
          contentExcerpt: excerpt(page.contentMarkdown, 1400),
          headings: page.headings,
        })),
      articles: articles.slice(0, 60).map((article) => ({
        id: article._id,
        title: article.title,
        primaryKeyword: article.primaryKeyword,
        status: article.status,
        metaDescription: article.metaDescription,
        contentExcerpt: excerpt(article.contentMarkdown || article.contentHtml, 1400),
        outlineJson: article.outlineJson,
        faqJson: article.faqJson,
      })),
      briefs: briefs.slice(0, 60).map((brief) => ({
        id: brief._id,
        title: brief.title,
        primaryKeyword: brief.primaryKeyword,
        searchIntent: brief.searchIntent,
        status: brief.status,
        priorityScore: brief.priorityScore,
        notes: brief.notes,
        nwGuidelinesPreview: jsonPreview(brief.nwGuidelines, 1200),
        researchPackPreview: jsonPreview(brief.researchPack, 1200),
      })),
      htmlExports: htmlExports.slice(0, 40).map((item) => ({
        id: item._id,
        articleId: item.articleId,
        name: item.name,
        designVariant: item.designVariant,
        htmlExcerpt: excerpt(item.htmlContent, 1000),
      })),
      contentAssets: contentAssets.slice(0, 80).map((asset) => ({
        id: asset._id,
        articleId: asset.articleId,
        assetType: asset.assetType,
        platform: asset.platform,
        title: asset.title,
        contentExcerpt: excerpt(asset.content, 1000),
        metadata: asset.metadata,
        status: asset.status,
      })),
      integrations: integrations.map((integration) => ({
        type: integration.type,
        isConnected: integration.isConnected,
        nwProjectName: integration.nwProjectName,
        nwLanguage: integration.nwLanguage,
        nwEngine: integration.nwEngine,
        wpSiteName: integration.wpSiteName,
        wpIsVerified: integration.wpIsVerified,
      })),
      gscConnection: gscConnection
        ? {
            gscProperty: gscConnection.gscProperty,
            connectedAt: gscConnection.connectedAt,
            propertyPermissionLevel: gscConnection.propertyPermissionLevel,
          }
        : null,
      dashboardPages: dashboardPages.slice(0, 40).map((page) => ({
        id: page._id,
        pageKey: page.pageKey,
        lang: page.lang,
        isDirty: page.isDirty,
        contentExcerpt: excerpt(page.contentJson, 1200),
      })),
    };
  },
});

export const saveCompleted = internalMutation({
  args: {
    analysisId: v.id("outreachAnalyses"),
    summary: v.string(),
    sourceCoverageJson: v.any(),
    opportunitiesJson: v.any(),
    recommendedCampaignJson: v.any(),
    createdCampaignId: v.optional(v.id("outreachCampaigns")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.analysisId, {
      status: "completed",
      summary: args.summary,
      sourceCoverageJson: args.sourceCoverageJson,
      opportunitiesJson: args.opportunitiesJson,
      recommendedCampaignJson: args.recommendedCampaignJson,
      createdCampaignId: args.createdCampaignId,
      updatedAt: Date.now(),
    });
  },
});

export const saveFailed = internalMutation({
  args: {
    analysisId: v.id("outreachAnalyses"),
    errorMessage: v.string(),
  },
  handler: async (ctx, { analysisId, errorMessage }) => {
    await ctx.db.patch(analysisId, {
      status: "failed",
      errorMessage,
      updatedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 3: Verify**

Run:

```bash
npx convex codegen --dry-run
```

Expected: Convex TypeScript succeeds.

## Task 2: Add Worker Actions and Trigger

**Files:**
- Create: `convex/agents/outreachIntelligenceActions.ts`
- Modify: `convex/agents/triggers.ts`
- Modify: `convex/tables/credits.ts`
- Modify: `src/inngest/lib/convex.ts`

- [ ] **Step 1: Add secured actions**

Create `convex/agents/outreachIntelligenceActions.ts`:

```ts
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

function verifyWorkerSecret(workerSecret: string) {
  const expected = process.env.OUTREACH_WORKER_SECRET || process.env.INNGEST_EVENT_KEY;
  if (!expected || workerSecret !== expected) {
    throw new Error("Unauthorized worker");
  }
}

export const createRunning = action({
  args: {
    projectId: v.id("projects"),
    workerSecret: v.string(),
  },
  handler: async (ctx, { projectId, workerSecret }) => {
    verifyWorkerSecret(workerSecret);
    return await ctx.runMutation(internal.tables.outreachIntelligence.createRunning, {
      projectId,
    });
  },
});

export const getContext = action({
  args: {
    projectId: v.id("projects"),
    workerSecret: v.string(),
  },
  handler: async (ctx, { projectId, workerSecret }) => {
    verifyWorkerSecret(workerSecret);
    return await ctx.runQuery(internal.tables.outreachIntelligence.getContext, {
      projectId,
    });
  },
});

export const saveCompleted = action({
  args: {
    analysisId: v.id("outreachAnalyses"),
    summary: v.string(),
    sourceCoverageJson: v.any(),
    opportunitiesJson: v.any(),
    recommendedCampaignJson: v.any(),
    createdCampaignId: v.optional(v.id("outreachCampaigns")),
    workerSecret: v.string(),
  },
  handler: async (ctx, { workerSecret, ...args }) => {
    verifyWorkerSecret(workerSecret);
    await ctx.runMutation(internal.tables.outreachIntelligence.saveCompleted, args);
  },
});

export const saveFailed = action({
  args: {
    analysisId: v.id("outreachAnalyses"),
    errorMessage: v.string(),
    workerSecret: v.string(),
  },
  handler: async (ctx, { analysisId, errorMessage, workerSecret }) => {
    verifyWorkerSecret(workerSecret);
    await ctx.runMutation(internal.tables.outreachIntelligence.saveFailed, {
      analysisId,
      errorMessage,
    });
  },
});
```

- [ ] **Step 2: Add trigger**

In `convex/agents/triggers.ts`, add `outreach-intelligence` to credit/event maps and add:

```ts
export const triggerOutreachIntelligence = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const context = await ctx.runQuery(internal.tables.projects.getProjectWorkspaceContext, {
      projectId,
    });
    if (!context || context.workspace.ownerId !== identity.subject) {
      throw new Error("Unauthorized: No access to this project");
    }

    const agentId = "outreach-intelligence";
    const payload = {
      name: "outreach/intelligence",
      data: {
        projectId,
        workspaceId: context.workspace._id,
        userId: identity.subject,
        customerId: context.workspace._id,
      },
    };

    const result = await sendInngestEvent(payload);
    return {
      success: true,
      eventId: result.ids?.[0],
      creditsRequired: AGENT_CREDITS[agentId],
      message: "Outreach intelligence started",
    };
  },
});
```

- [ ] **Step 3: Add credits**

Add `"outreach-intelligence": 6` wherever agent credit maps are defined in `convex/agents/triggers.ts`, `convex/tables/credits.ts`, and `src/inngest/lib/convex.ts`.

- [ ] **Step 4: Verify**

Run:

```bash
npx convex codegen --dry-run
```

Expected: no errors.

## Task 3: Add Inngest Intelligence Agent

**Files:**
- Create: `src/inngest/functions/growth/outreachIntelligence.ts`
- Modify: `src/inngest/index.ts`
- Modify: `api/inngest.ts`

- [ ] **Step 1: Create agent**

Create `src/inngest/functions/growth/outreachIntelligence.ts` with:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { inngest } from "../../client.js";
import { api, convex, AGENT_CREDITS, calculateCostCents, getEnvVar } from "../../lib/convex.js";

const AGENT_ID = "outreach-intelligence";
const CREDITS_REQUIRED = AGENT_CREDITS[AGENT_ID];

const SYSTEM_PROMPT = `Du bist der Outreach Intelligence Agent fuer SEO Ops Magic.

Ziel: Verstehe das Projekt aus vorhandenen Dashboard-Daten und bewerte, welche Content Pieces oder neuen Assets sich als Linkbait eignen.

Bewerte nach:
- Zitierfaehigkeit / Linkability
- thematische Relevanz fuer die Marke
- vorhandene Substanz im Content
- Upgrade-Potenzial zu Tool, Studie, Whitepaper, Template, Datenasset oder Guide
- Outreach-Winkel fuer Resource Pages, Digital PR, Expertenzitate, Partnerschaften und Broken Link Building

Antworte ausschliesslich als gueltiges JSON mit:
summary, sourceCoverage, opportunities, recommendedCampaign.
`;

type SitemapResult = {
  sitemaps: string[];
  urls: string[];
  errors: string[];
};

function normalizeDomain(value?: string): string | null {
  if (!value) return null;
  try {
    const withProtocol = value.startsWith("http") ? value : `https://${value}`;
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function extractLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi))
    .map((match) => match[1]?.trim())
    .filter((url): url is string => Boolean(url));
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: { "User-Agent": "SEO-Ops-Magic-Outreach/1.0" } });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function discoverSitemap(baseUrl: string): Promise<SitemapResult> {
  const errors: string[] = [];
  const sitemaps = new Set<string>();
  const urls = new Set<string>();
  const robots = await fetchText(`${baseUrl}/robots.txt`);
  if (robots) {
    for (const line of robots.split(/\r?\n/)) {
      const match = line.match(/^sitemap:\s*(.+)$/i);
      if (match?.[1]) sitemaps.add(match[1].trim());
    }
  }
  for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml"]) {
    sitemaps.add(`${baseUrl}${path}`);
  }

  for (const sitemap of Array.from(sitemaps).slice(0, 8)) {
    const xml = await fetchText(sitemap);
    if (!xml) {
      errors.push(`Could not fetch ${sitemap}`);
      continue;
    }
    const locs = extractLocs(xml);
    const nested = locs.filter((loc) => loc.includes("sitemap") && loc.endsWith(".xml"));
    const pageLocs = locs.filter((loc) => !nested.includes(loc));
    pageLocs.forEach((loc) => urls.add(loc));
    for (const child of nested.slice(0, 8)) {
      const childXml = await fetchText(child);
      if (!childXml) continue;
      extractLocs(childXml).forEach((loc) => urls.add(loc));
    }
  }

  return { sitemaps: Array.from(sitemaps), urls: Array.from(urls).slice(0, 80), errors };
}

function parseJsonObject(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not parse JSON response");
  return JSON.parse(match[0]) as Record<string, unknown>;
}

export const outreachIntelligence = inngest.createFunction(
  {
    id: "outreach-intelligence",
    name: "Outreach Intelligence",
    concurrency: { limit: 2, key: "event.data.customerId" },
    retries: 1,
  },
  { event: "outreach/intelligence" },
  async ({ event, step }) => {
    const { projectId, userId, workspaceId } = event.data as {
      projectId: string;
      userId: string;
      workspaceId: string;
      customerId: string;
    };
    const workerSecret = getEnvVar("OUTREACH_WORKER_SECRET");
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    await step.run("check-credits", async () => {
      const result = await convex.action(api.agents.actions.checkAndReserveCredits, {
        workspaceId,
        agentId: AGENT_ID,
        requiredCredits: CREDITS_REQUIRED,
      });
      if (!result.success) throw new Error(result.error || "Credit check failed");
    });

    const analysisId = await step.run("create-analysis", async () => {
      await convex.action(api.agents.actions.createAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        userId,
        workspaceId,
        projectId,
        agentId: AGENT_ID,
        eventType: "outreach/intelligence",
        inputData: { projectId },
        creditsReserved: CREDITS_REQUIRED,
      });
      return await convex.action(api.agents.outreachIntelligenceActions.createRunning, {
        projectId,
        workerSecret,
      });
    });

    try {
      const context = await step.run("fetch-context", async () => {
        return await convex.action(api.agents.outreachIntelligenceActions.getContext, {
          projectId,
          workerSecret,
        });
      });
      if (!context?.project) throw new Error("Project context not found");

      const sitemap = await step.run("fetch-sitemap", async () => {
        const baseUrl =
          normalizeDomain(context.project.domain) || normalizeDomain(context.project.wpUrl);
        return baseUrl ? await discoverSitemap(baseUrl) : { sitemaps: [], urls: [], errors: ["No domain configured"] };
      });

      const generated = await step.run("generate-intelligence", async () => {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 6000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Analysiere dieses Projekt fuer Linkbait- und Outreach-Potenziale.

Projektkontext:
${JSON.stringify(context, null, 2).slice(0, 26000)}

Live-Sitemap:
${JSON.stringify(sitemap, null, 2).slice(0, 8000)}

Gib nur JSON im geforderten Format zurueck.`,
            },
          ],
        });
        inputTokens = response.usage.input_tokens;
        outputTokens = response.usage.output_tokens;
        const text = response.content.find((item) => item.type === "text");
        if (!text || text.type !== "text") throw new Error("No text response");
        return parseJsonObject(text.text);
      });

      const recommendedCampaign = generated.recommendedCampaign as Record<string, unknown> | undefined;
      const campaignName =
        typeof recommendedCampaign?.name === "string"
          ? recommendedCampaign.name
          : "KI Linkbait Outreach";
      const targetDomain =
        typeof recommendedCampaign?.targetDomain === "string"
          ? recommendedCampaign.targetDomain
          : context.project.domain;

      const campaignId = await step.run("create-generated-campaign", async () => {
        return await convex.mutation(api.tables.outreach.createCampaignInternal, {
          projectId,
          name: campaignName,
          campaignType: "linkbuilding",
          targetDomain,
          competitors: [],
          goalTargetsJson: recommendedCampaign?.goals ? { notes: recommendedCampaign.goals } : undefined,
          strategyJson: {
            ...(recommendedCampaign?.strategy && typeof recommendedCampaign.strategy === "object"
              ? recommendedCampaign.strategy
              : {}),
            intelligenceSummary: generated.summary,
            opportunities: generated.opportunities,
          },
          status: "ready",
        });
      });

      await step.run("save-analysis", async () => {
        await convex.action(api.agents.outreachIntelligenceActions.saveCompleted, {
          analysisId,
          summary: typeof generated.summary === "string" ? generated.summary : "Analyse abgeschlossen.",
          sourceCoverageJson: generated.sourceCoverage || {},
          opportunitiesJson: generated.opportunities || [],
          recommendedCampaignJson: generated.recommendedCampaign || {},
          createdCampaignId: campaignId,
          workerSecret,
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
          result: { analysisId, campaignId },
        });
      });

      return {
        success: true,
        analysisId,
        campaignId,
        usage: { inputTokens, outputTokens, estimatedCostCents: calculateCostCents(inputTokens, outputTokens) },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await convex.action(api.agents.outreachIntelligenceActions.saveFailed, {
        analysisId,
        errorMessage: message,
        workerSecret,
      });
      throw error;
    }
  }
);
```

- [ ] **Step 2: Add internal campaign creation**

Add an internal mutation to `convex/tables/outreach.ts` named `createCampaignInternal` that accepts projectId/name/campaignType/targetDomain/competitors/goalTargetsJson/strategyJson/status and inserts a campaign without Clerk auth. It is only called from secured worker code.

- [ ] **Step 3: Register agent**

Import/export `outreachIntelligence` in `src/inngest/index.ts` and register it in `api/inngest.ts`.

- [ ] **Step 4: Verify**

Run:

```bash
npm run build
npx convex codegen --dry-run
```

Expected: both succeed.

## Task 4: Build AI-First Outreach UI

**Files:**
- Create: `src/components/outreach/OutreachIntelligencePanel.tsx`
- Modify: `src/pages/Outreach.tsx`

- [ ] **Step 1: Create panel**

Create a panel that:
- queries `api.tables.outreachIntelligence.latestByProject`
- triggers `api.agents.triggers.triggerOutreachIntelligence`
- shows `running/completed/failed`
- lists top opportunities from `opportunitiesJson`
- links to `createdCampaignId` when available

- [ ] **Step 2: Rework Outreach page**

On `src/pages/Outreach.tsx`:
- change primary title copy to `KI Outreach`
- use `OutreachIntelligencePanel` above stats/table
- rename primary CTA to `KI analysieren`
- move manual campaign creation to a small secondary button
- update empty campaign copy to emphasize AI analysis first

- [ ] **Step 3: Verify**

Run:

```bash
npm run build
npx eslint src/components/outreach/OutreachIntelligencePanel.tsx src/pages/Outreach.tsx
```

Expected: both succeed.

## Task 5: Deploy

**Files:**
- All changed files.

- [ ] **Step 1: Full verification**

Run:

```bash
npm run build
npx convex codegen --dry-run
npx vercel build --prod
```

Expected: all succeed.

- [ ] **Step 2: Commit**

```bash
git add convex src api package.json package-lock.json docs/superpowers
git commit -m "feat: add outreach intelligence"
```

- [ ] **Step 3: Deploy Convex production**

```bash
npx convex deploy
```

Expected: deploy to `deafening-chicken-681`.

- [ ] **Step 4: Deploy Vercel production**

```bash
npx vercel deploy --prebuilt --prod --yes
```

Expected: deployment aliased to `https://notamsign.com`.

- [ ] **Step 5: Smoke**

Run:

```bash
Invoke-WebRequest -UseBasicParsing https://notamsign.com/projects/test/outreach
Invoke-WebRequest -UseBasicParsing https://notamsign.com/api/inngest
```

Expected: both HTTP 200; `/api/inngest` function count increases by one.

## Self-Review

Spec coverage:
- AI-first entry point is implemented by `OutreachIntelligencePanel`.
- Existing dashboard data is loaded by `getContext`.
- Sitemap inspection is implemented in the Inngest worker.
- Linkbait evaluation is in the Claude JSON contract.
- CRM/campaign fields are filled by generated campaign creation.

Placeholder scan:
- No placeholder markers remain.

Type consistency:
- `outreachAnalyses` IDs, `outreachCampaigns` IDs, and project IDs use Convex IDs.
- Agent ID is consistently `outreach-intelligence`.
- Event name is consistently `outreach/intelligence`.
