import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Elementor Templates queries and mutations
 *
 * Elementor templates are page builder JSON exports for WordPress import.
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
 * List all elementor templates for a project
 */
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      return [];
    }

    const templates = await ctx.db
      .query("elementorTemplates")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    // Sort by _creationTime descending (most recent first)
    return templates.sort((a, b) => b._creationTime - a._creationTime);
  },
});

/**
 * Get elementor template for an article
 */
export const getByArticle = query({
  args: { articleId: v.id("articles") },
  handler: async (ctx, { articleId }) => {
    const userId = await requireAuth(ctx);

    // Get article to verify access
    const article = await ctx.db.get(articleId);
    if (!article) {
      return null;
    }

    if (!(await verifyProjectAccess(ctx, article.projectId, userId))) {
      return null;
    }

    const templates = await ctx.db
      .query("elementorTemplates")
      .withIndex("by_article", (q) => q.eq("articleId", articleId))
      .collect();

    return templates[0] ?? null;
  },
});

/**
 * Get a single elementor template by ID
 */
export const get = query({
  args: { id: v.id("elementorTemplates") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const template = await ctx.db.get(id);
    if (!template) {
      return null;
    }

    if (!(await verifyProjectAccess(ctx, template.projectId, userId))) {
      return null;
    }

    return template;
  },
});

/**
 * Create a new elementor template
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    articleId: v.optional(v.id("articles")),
    name: v.string(),
    templateJson: v.any(),
    designPreset: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, args.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    return await ctx.db.insert("elementorTemplates", {
      projectId: args.projectId,
      articleId: args.articleId,
      name: args.name,
      templateJson: args.templateJson,
      designPreset: args.designPreset ?? "default",
    });
  },
});

/**
 * Update an elementor template
 */
export const update = mutation({
  args: {
    id: v.id("elementorTemplates"),
    name: v.optional(v.string()),
    templateJson: v.optional(v.any()),
    designPreset: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await requireAuth(ctx);

    const template = await ctx.db.get(id);
    if (!template) {
      throw new Error("Elementor template not found");
    }

    if (!(await verifyProjectAccess(ctx, template.projectId, userId))) {
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
 * Delete an elementor template
 */
export const remove = mutation({
  args: { id: v.id("elementorTemplates") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const template = await ctx.db.get(id);
    if (!template) {
      throw new Error("Elementor template not found");
    }

    if (!(await verifyProjectAccess(ctx, template.projectId, userId))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(id);
  },
});
