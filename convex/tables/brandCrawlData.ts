import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Brand Crawl Data queries and mutations
 *
 * Stores raw crawled page data for brand analysis.
 */

async function verifyBrandProfileAccess(
  ctx: any,
  brandProfileId: any,
  userId: string
): Promise<boolean> {
  const profile = await ctx.db.get(brandProfileId);
  if (!profile) return false;

  const project = await ctx.db.get(profile.projectId);
  if (!project) return false;

  const workspace = await ctx.db.get(project.workspaceId);
  if (!workspace) return false;

  return workspace.ownerId === userId;
}

/**
 * Get all crawl data for a brand profile
 */
export const listByBrandProfile = query({
  args: { brandProfileId: v.id("brandProfiles") },
  handler: async (ctx, { brandProfileId }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyBrandProfileAccess(ctx, brandProfileId, userId))) {
      return [];
    }

    return await ctx.db
      .query("brandCrawlData")
      .withIndex("by_brand_profile", (q) => q.eq("brandProfileId", brandProfileId))
      .collect();
  },
});

/**
 * Get top N crawl data by relevance score
 */
export const getTopByRelevance = query({
  args: {
    brandProfileId: v.id("brandProfiles"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { brandProfileId, limit = 15 }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyBrandProfileAccess(ctx, brandProfileId, userId))) {
      return [];
    }

    const allData = await ctx.db
      .query("brandCrawlData")
      .withIndex("by_brand_profile", (q) => q.eq("brandProfileId", brandProfileId))
      .collect();

    // Sort by relevance score descending
    return allData
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
      .slice(0, limit);
  },
});

/**
 * Insert crawl data (internal, called from webhook)
 */
export const insertMany = internalMutation({
  args: {
    data: v.array(
      v.object({
        brandProfileId: v.id("brandProfiles"),
        url: v.string(),
        title: v.optional(v.string()),
        contentMarkdown: v.optional(v.string()),
        metaDescription: v.optional(v.string()),
        pageType: v.optional(v.string()),
        headings: v.optional(v.any()),
        internalLinks: v.optional(v.any()),
        externalLinks: v.optional(v.any()),
        images: v.optional(v.any()),
        relevanceScore: v.optional(v.number()),
        crawledAt: v.number(),
      })
    ),
  },
  handler: async (ctx, { data }) => {
    const ids = [];
    for (const item of data) {
      const id = await ctx.db.insert("brandCrawlData", item);
      ids.push(id);
    }
    return ids;
  },
});

/**
 * Delete all crawl data for a brand profile (internal)
 */
export const deleteByBrandProfile = internalMutation({
  args: { brandProfileId: v.id("brandProfiles") },
  handler: async (ctx, { brandProfileId }) => {
    const data = await ctx.db
      .query("brandCrawlData")
      .withIndex("by_brand_profile", (q) => q.eq("brandProfileId", brandProfileId))
      .collect();

    for (const item of data) {
      await ctx.db.delete(item._id);
    }
  },
});
