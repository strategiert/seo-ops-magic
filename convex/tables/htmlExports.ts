import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * HTML Export queries and mutations
 *
 * HTML exports are standalone HTML landing pages generated from articles.
 * They contain all styling inline for portability.
 */

/**
 * Verify user has access to a project
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
 * List all HTML exports for a project
 */
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      return [];
    }

    return await ctx.db
      .query("htmlExports")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

/**
 * Get HTML exports for an article
 * Returns most recent first
 */
export const getByArticle = query({
  args: { articleId: v.id("articles") },
  handler: async (ctx, { articleId }) => {
    const userId = await requireAuth(ctx);

    // Get article to verify access
    const article = await ctx.db.get(articleId);
    if (!article) {
      return [];
    }

    if (!(await verifyProjectAccess(ctx, article.projectId, userId))) {
      return [];
    }

    const exports = await ctx.db
      .query("htmlExports")
      .withIndex("by_article", (q) => q.eq("articleId", articleId))
      .collect();

    // Sort by _creationTime descending (most recent first)
    return exports.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/**
 * Get a single HTML export by ID
 */
export const get = query({
  args: { id: v.id("htmlExports") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const htmlExport = await ctx.db.get(id);
    if (!htmlExport) {
      return null;
    }

    if (!(await verifyProjectAccess(ctx, htmlExport.projectId, userId))) {
      return null;
    }

    return htmlExport;
  },
});

/**
 * Create a new HTML export
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    articleId: v.optional(v.id("articles")),
    name: v.string(),
    htmlContent: v.string(),
    designVariant: v.optional(v.string()),
    recipeVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, args.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    return await ctx.db.insert("htmlExports", {
      projectId: args.projectId,
      articleId: args.articleId,
      name: args.name,
      htmlContent: args.htmlContent,
      designVariant: args.designVariant ?? "default",
      recipeVersion: args.recipeVersion,
    });
  },
});

/**
 * Update an HTML export
 */
export const update = mutation({
  args: {
    id: v.id("htmlExports"),
    name: v.optional(v.string()),
    htmlContent: v.optional(v.string()),
    designVariant: v.optional(v.string()),
    recipeVersion: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await requireAuth(ctx);

    const htmlExport = await ctx.db.get(id);
    if (!htmlExport) {
      throw new Error("HTML export not found");
    }

    if (!(await verifyProjectAccess(ctx, htmlExport.projectId, userId))) {
      throw new Error("Unauthorized");
    }

    // Filter out undefined values
    const patchData: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patchData[key] = value;
      }
    }

    await ctx.db.patch(id, patchData);
    return id;
  },
});

/**
 * Delete an HTML export
 */
export const remove = mutation({
  args: { id: v.id("htmlExports") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const htmlExport = await ctx.db.get(id);
    if (!htmlExport) {
      throw new Error("HTML export not found");
    }

    if (!(await verifyProjectAccess(ctx, htmlExport.projectId, userId))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(id);
  },
});
