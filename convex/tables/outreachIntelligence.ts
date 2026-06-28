import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
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

function excerpt(value: string | undefined, maxLength = 1200): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function jsonPreview(value: unknown, maxLength = 1200): string {
  if (value === undefined || value === null) return "";

  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch {
    return String(value).slice(0, maxLength);
  }
}

export const latestByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      return null;
    }

    const analyses = await ctx.db
      .query("outreachAnalyses")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return analyses.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  },
});

export const createRunning = internalMutation({
  args: {
    projectId: v.id("projects"),
  },
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

export const createQueued = internalMutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const now = Date.now();

    return await ctx.db.insert("outreachAnalyses", {
      projectId,
      status: "queued",
      summary:
        "Die KI-Analyse wurde gestartet und wartet auf den Outreach-Worker.",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const markRunning = internalMutation({
  args: {
    analysisId: v.id("outreachAnalyses"),
  },
  handler: async (ctx, { analysisId }) => {
    await ctx.db.patch(analysisId, {
      status: "running",
      summary:
        "Die KI sammelt Projektkontext, Sitemap und vorhandene Inhalte.",
      errorMessage: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const getContext = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
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
          .withIndex("by_brand_profile", (q) =>
            q.eq("brandProfileId", brandProfile._id)
          )
          .collect()
      : [];

    const [
      articles,
      briefs,
      htmlExports,
      contentAssets,
      integrations,
      gscConnection,
      dashboardPages,
    ] = await Promise.all([
      ctx.db
        .query("articles")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect(),
      ctx.db
        .query("contentBriefs")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect(),
      ctx.db
        .query("htmlExports")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect(),
      ctx.db
        .query("contentAssets")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect(),
      ctx.db
        .query("integrations")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect(),
      ctx.db
        .query("gscConnections")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .first(),
      ctx.db.query("bodycamPages").collect(),
    ]);

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
          internalLinks: page.internalLinks,
          externalLinks: page.externalLinks,
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
      htmlExports: htmlExports.slice(0, 40).map((htmlExport) => ({
        id: htmlExport._id,
        articleId: htmlExport.articleId,
        name: htmlExport.name,
        designVariant: htmlExport.designVariant,
        htmlExcerpt: excerpt(htmlExport.htmlContent, 1000),
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
  handler: async (
    ctx,
    {
      analysisId,
      summary,
      sourceCoverageJson,
      opportunitiesJson,
      recommendedCampaignJson,
      createdCampaignId,
    }
  ) => {
    await ctx.db.patch(analysisId, {
      status: "completed",
      summary,
      sourceCoverageJson,
      opportunitiesJson,
      recommendedCampaignJson,
      createdCampaignId,
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

export const removeAnalysis = mutation({
  args: {
    analysisId: v.id("outreachAnalyses"),
  },
  handler: async (ctx, { analysisId }) => {
    const userId = await requireAuth(ctx);
    const analysis = await ctx.db.get(analysisId);

    if (!analysis) {
      throw new Error("Analysis not found");
    }

    if (!(await verifyProjectAccess(ctx, analysis.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    await ctx.db.delete(analysisId);
  },
});
