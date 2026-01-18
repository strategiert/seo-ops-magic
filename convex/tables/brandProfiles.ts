import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Brand Profile queries and mutations
 *
 * Brand profiles store comprehensive brand data extracted from website crawling
 * and AI analysis. Each project has one brand profile.
 */

async function verifyProjectAccess(
  ctx: any,
  projectId: any,
  userId: string
): Promise<boolean> {
  const project = await ctx.db.get(projectId);
  if (!project) return false;

  const workspace = await ctx.db.get(project.workspaceId);
  if (!workspace) return false;

  return workspace.ownerId === userId;
}

/**
 * Get brand profile for a project
 */
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      return null;
    }

    const profiles = await ctx.db
      .query("brandProfiles")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return profiles[0] ?? null;
  },
});

/**
 * Get brand profile by ID
 */
export const get = query({
  args: { id: v.id("brandProfiles") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const profile = await ctx.db.get(id);
    if (!profile) return null;

    if (!(await verifyProjectAccess(ctx, profile.projectId, userId))) {
      return null;
    }

    return profile;
  },
});

/**
 * Get brand profile with crawl data
 */
export const getWithCrawlData = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      return null;
    }

    const profiles = await ctx.db
      .query("brandProfiles")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const profile = profiles[0];
    if (!profile) return null;

    // Get crawl data
    const crawlData = await ctx.db
      .query("brandCrawlData")
      .withIndex("by_brand_profile", (q) => q.eq("brandProfileId", profile._id))
      .collect();

    // Get vector documents
    const vectorDocs = await ctx.db
      .query("brandVectorDocuments")
      .withIndex("by_brand_profile", (q) => q.eq("brandProfileId", profile._id))
      .collect();

    return {
      ...profile,
      crawlData,
      vectorDocuments: vectorDocs,
    };
  },
});

/**
 * Create or update brand profile for a project
 */
export const upsert = mutation({
  args: {
    projectId: v.id("projects"),
    brandName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    missionStatement: v.optional(v.string()),
    brandStory: v.optional(v.string()),
    brandVoice: v.optional(v.any()),
    products: v.optional(v.any()),
    services: v.optional(v.any()),
    personas: v.optional(v.any()),
    brandKeywords: v.optional(v.any()),
    competitors: v.optional(v.any()),
    visualIdentity: v.optional(v.any()),
  },
  handler: async (ctx, { projectId, ...data }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("brandProfiles")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("brandProfiles", {
      projectId,
      ...data,
      crawlStatus: "pending",
    });
  },
});

/**
 * Update crawl status
 */
export const updateCrawlStatus = mutation({
  args: {
    id: v.id("brandProfiles"),
    crawlStatus: v.string(),
    crawlJobId: v.optional(v.string()),
    crawlError: v.optional(v.string()),
  },
  handler: async (ctx, { id, crawlStatus, crawlJobId, crawlError }) => {
    const userId = await requireAuth(ctx);

    const profile = await ctx.db.get(id);
    if (!profile) {
      throw new Error("Brand profile not found");
    }

    if (!(await verifyProjectAccess(ctx, profile.projectId, userId))) {
      throw new Error("Unauthorized");
    }

    const update: Record<string, any> = { crawlStatus };
    if (crawlJobId !== undefined) update.crawlJobId = crawlJobId;
    if (crawlError !== undefined) update.crawlError = crawlError;
    if (crawlStatus === "crawling") update.lastCrawlAt = Date.now();
    if (crawlStatus === "completed") update.lastAnalysisAt = Date.now();

    await ctx.db.patch(id, update);
  },
});

/**
 * Update brand analysis results (called after AI analysis)
 */
export const updateAnalysis = mutation({
  args: {
    id: v.id("brandProfiles"),
    brandName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    missionStatement: v.optional(v.string()),
    brandStory: v.optional(v.string()),
    brandVoice: v.optional(v.any()),
    products: v.optional(v.any()),
    services: v.optional(v.any()),
    personas: v.optional(v.any()),
    brandKeywords: v.optional(v.any()),
    visualIdentity: v.optional(v.any()),
    crawlStatus: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await requireAuth(ctx);

    const profile = await ctx.db.get(id);
    if (!profile) {
      throw new Error("Brand profile not found");
    }

    if (!(await verifyProjectAccess(ctx, profile.projectId, userId))) {
      throw new Error("Unauthorized");
    }

    const patchData: Record<string, any> = { lastAnalysisAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patchData[key] = value;
      }
    }

    await ctx.db.patch(id, patchData);
  },
});

/**
 * Update vector store ID
 */
export const updateVectorStore = mutation({
  args: {
    id: v.id("brandProfiles"),
    openaiVectorStoreId: v.string(),
  },
  handler: async (ctx, { id, openaiVectorStoreId }) => {
    const userId = await requireAuth(ctx);

    const profile = await ctx.db.get(id);
    if (!profile) {
      throw new Error("Brand profile not found");
    }

    if (!(await verifyProjectAccess(ctx, profile.projectId, userId))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(id, { openaiVectorStoreId });
  },
});

/**
 * Reset brand profile (delete crawl data and vector docs)
 */
export const reset = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      throw new Error("Unauthorized");
    }

    const profile = await ctx.db
      .query("brandProfiles")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();

    if (!profile) return;

    // Delete crawl data
    const crawlData = await ctx.db
      .query("brandCrawlData")
      .withIndex("by_brand_profile", (q) => q.eq("brandProfileId", profile._id))
      .collect();

    for (const data of crawlData) {
      await ctx.db.delete(data._id);
    }

    // Delete vector documents
    const vectorDocs = await ctx.db
      .query("brandVectorDocuments")
      .withIndex("by_brand_profile", (q) => q.eq("brandProfileId", profile._id))
      .collect();

    for (const doc of vectorDocs) {
      await ctx.db.delete(doc._id);
    }

    // Reset profile
    await ctx.db.patch(profile._id, {
      brandName: undefined,
      tagline: undefined,
      missionStatement: undefined,
      brandStory: undefined,
      brandVoice: undefined,
      products: undefined,
      services: undefined,
      personas: undefined,
      brandKeywords: undefined,
      competitors: undefined,
      visualIdentity: undefined,
      crawlStatus: "pending",
      crawlError: undefined,
      crawlJobId: undefined,
      openaiVectorStoreId: undefined,
      lastCrawlAt: undefined,
      lastAnalysisAt: undefined,
    });
  },
});

/**
 * Internal mutation for webhook to update profile
 */
export const internalUpdate = internalMutation({
  args: {
    id: v.id("brandProfiles"),
    updates: v.any(),
  },
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, updates);
  },
});

/**
 * Internal query to get brand profile by crawl job ID
 */
import { internalQuery } from "../_generated/server";

export const getByJobId = internalQuery({
  args: { jobId: v.string() },
  handler: async (ctx, { jobId }) => {
    return await ctx.db
      .query("brandProfiles")
      .withIndex("by_crawl_job", (q) => q.eq("crawlJobId", jobId))
      .collect();
  },
});
