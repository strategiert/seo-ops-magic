import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Article Design Recipe queries and mutations
 *
 * Design recipes store LLM-generated layout decisions for articles.
 */

async function verifyArticleAccess(
  ctx: any,
  articleId: any,
  userId: string
): Promise<boolean> {
  const article = await ctx.db.get(articleId);
  if (!article) return false;

  const project = await ctx.db.get(article.projectId);
  if (!project) return false;

  const workspace = await ctx.db.get(project.workspaceId);
  if (!workspace) return false;

  return workspace.ownerId === userId;
}

/**
 * Get design recipe for an article
 */
export const getByArticle = query({
  args: { articleId: v.id("articles") },
  handler: async (ctx, { articleId }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyArticleAccess(ctx, articleId, userId))) {
      return [];
    }

    return await ctx.db
      .query("articleDesignRecipes")
      .withIndex("by_article", (q) => q.eq("articleId", articleId))
      .collect();
  },
});

/**
 * Get a single recipe by ID
 */
export const get = query({
  args: { id: v.id("articleDesignRecipes") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const recipe = await ctx.db.get(id);
    if (!recipe) return null;

    if (!(await verifyArticleAccess(ctx, recipe.articleId, userId))) {
      return null;
    }

    return recipe;
  },
});

/**
 * Create or update design recipe for an article
 */
export const upsert = mutation({
  args: {
    articleId: v.id("articles"),
    recipeJson: v.any(),
    recipeVersion: v.string(),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, { articleId, recipeJson, recipeVersion, provider }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyArticleAccess(ctx, articleId, userId))) {
      throw new Error("Unauthorized");
    }

    // Check for existing recipe
    const existing = await ctx.db
      .query("articleDesignRecipes")
      .withIndex("by_article", (q) => q.eq("articleId", articleId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        recipeJson,
        recipeVersion,
        provider,
      });
      return existing._id;
    }

    return await ctx.db.insert("articleDesignRecipes", {
      articleId,
      recipeJson,
      recipeVersion,
      provider,
    });
  },
});

/**
 * Delete design recipe
 */
export const remove = mutation({
  args: { id: v.id("articleDesignRecipes") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const recipe = await ctx.db.get(id);
    if (!recipe) {
      throw new Error("Recipe not found");
    }

    if (!(await verifyArticleAccess(ctx, recipe.articleId, userId))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(id);
  },
});
