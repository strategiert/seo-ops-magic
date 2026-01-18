import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Article queries and mutations
 *
 * Articles are the main content output of the platform.
 * They can be generated from content briefs or imported directly.
 */

/**
 * Verify user has access to a project
 * Returns true if user owns the workspace containing the project
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
 * List all articles in a project
 */
export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, status }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      return [];
    }

    let articlesQuery = ctx.db
      .query("articles")
      .withIndex("by_project", (q) => q.eq("projectId", projectId));

    const articles = await articlesQuery.collect();

    // Filter by status if provided
    if (status) {
      return articles.filter((a) => a.status === status);
    }

    return articles;
  },
});

/**
 * Get a single article by ID
 */
export const get = query({
  args: { id: v.id("articles") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const article = await ctx.db.get(id);
    if (!article) return null;

    if (!(await verifyProjectAccess(ctx, article.projectId, userId))) {
      return null;
    }

    return article;
  },
});

/**
 * Get article with its design recipe
 */
export const getWithRecipe = query({
  args: { id: v.id("articles") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const article = await ctx.db.get(id);
    if (!article) return null;

    if (!(await verifyProjectAccess(ctx, article.projectId, userId))) {
      return null;
    }

    // Get the design recipe if it exists
    const recipes = await ctx.db
      .query("articleDesignRecipes")
      .withIndex("by_article", (q) => q.eq("articleId", id))
      .collect();

    return {
      ...article,
      designRecipe: recipes[0] ?? null,
    };
  },
});

/**
 * Create a new article
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    briefId: v.optional(v.id("contentBriefs")),
    title: v.string(),
    primaryKeyword: v.optional(v.string()),
    contentMarkdown: v.optional(v.string()),
    contentHtml: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    outlineJson: v.optional(v.any()),
    faqJson: v.optional(v.any()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, args.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    const articleId = await ctx.db.insert("articles", {
      projectId: args.projectId,
      briefId: args.briefId,
      title: args.title,
      primaryKeyword: args.primaryKeyword,
      contentMarkdown: args.contentMarkdown,
      contentHtml: args.contentHtml,
      metaTitle: args.metaTitle,
      metaDescription: args.metaDescription,
      outlineJson: args.outlineJson,
      faqJson: args.faqJson,
      status: args.status ?? "draft",
      version: 1,
    });

    return articleId;
  },
});

/**
 * Update an article
 */
export const update = mutation({
  args: {
    id: v.id("articles"),
    title: v.optional(v.string()),
    primaryKeyword: v.optional(v.string()),
    contentMarkdown: v.optional(v.string()),
    contentHtml: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    outlineJson: v.optional(v.any()),
    faqJson: v.optional(v.any()),
    status: v.optional(v.string()),
    version: v.optional(v.number()),
    wpPostId: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await requireAuth(ctx);

    const article = await ctx.db.get(id);
    if (!article) {
      throw new Error("Article not found");
    }

    if (!(await verifyProjectAccess(ctx, article.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
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
 * Update article content (used during generation)
 */
export const updateContent = mutation({
  args: {
    id: v.id("articles"),
    contentMarkdown: v.string(),
    contentHtml: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    faqJson: v.optional(v.any()),
    outlineJson: v.optional(v.any()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await requireAuth(ctx);

    const article = await ctx.db.get(id);
    if (!article) {
      throw new Error("Article not found");
    }

    if (!(await verifyProjectAccess(ctx, article.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    await ctx.db.patch(id, {
      ...updates,
      version: (article.version ?? 1) + 1,
    });

    return id;
  },
});

/**
 * Delete an article
 */
export const remove = mutation({
  args: { id: v.id("articles") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const article = await ctx.db.get(id);
    if (!article) {
      throw new Error("Article not found");
    }

    if (!(await verifyProjectAccess(ctx, article.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    // Delete related design recipe
    const recipes = await ctx.db
      .query("articleDesignRecipes")
      .withIndex("by_article", (q) => q.eq("articleId", id))
      .collect();

    for (const recipe of recipes) {
      await ctx.db.delete(recipe._id);
    }

    // Delete related HTML exports
    const exports = await ctx.db
      .query("htmlExports")
      .withIndex("by_article", (q) => q.eq("articleId", id))
      .collect();

    for (const exp of exports) {
      await ctx.db.delete(exp._id);
    }

    // Delete the article
    await ctx.db.delete(id);
  },
});
