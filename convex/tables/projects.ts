import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Project queries and mutations
 *
 * Projects belong to workspaces and contain all SEO content:
 * - Content briefs
 * - Articles
 * - Brand profiles
 * - Integrations
 */

/**
 * List all projects in a workspace
 * User must own the workspace
 */
export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const userId = await requireAuth(ctx);

    // Verify workspace ownership
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace || workspace.ownerId !== userId) {
      return [];
    }

    return await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
  },
});

/**
 * Get a single project by ID
 * User must own the parent workspace
 */
export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const project = await ctx.db.get(id);
    if (!project) {
      return null;
    }

    // Verify workspace ownership
    const workspace = await ctx.db.get(project.workspaceId);
    if (!workspace || workspace.ownerId !== userId) {
      return null;
    }

    return project;
  },
});

/**
 * Create a new project in a workspace
 */
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    domain: v.optional(v.string()),
    wpUrl: v.optional(v.string()),
    defaultLanguage: v.optional(v.string()),
    defaultCountry: v.optional(v.string()),
    defaultTonality: v.optional(v.string()),
    defaultTargetAudience: v.optional(v.string()),
    defaultDesignPreset: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    // Verify workspace ownership
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.ownerId !== userId) {
      throw new Error("Unauthorized: Not workspace owner");
    }

    const projectId = await ctx.db.insert("projects", {
      workspaceId: args.workspaceId,
      name: args.name,
      domain: args.domain,
      wpUrl: args.wpUrl,
      defaultLanguage: args.defaultLanguage ?? "de",
      defaultCountry: args.defaultCountry ?? "DE",
      defaultTonality: args.defaultTonality,
      defaultTargetAudience: args.defaultTargetAudience,
      defaultDesignPreset: args.defaultDesignPreset ?? "default",
    });

    return projectId;
  },
});

/**
 * Update a project
 */
export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
    wpUrl: v.optional(v.string()),
    defaultLanguage: v.optional(v.string()),
    defaultCountry: v.optional(v.string()),
    defaultTonality: v.optional(v.string()),
    defaultTargetAudience: v.optional(v.string()),
    defaultDesignPreset: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await requireAuth(ctx);

    const project = await ctx.db.get(id);
    if (!project) {
      throw new Error("Project not found");
    }

    // Verify workspace ownership
    const workspace = await ctx.db.get(project.workspaceId);
    if (!workspace || workspace.ownerId !== userId) {
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
 * Delete a project
 * This will cascade delete all related content
 */
export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const project = await ctx.db.get(id);
    if (!project) {
      throw new Error("Project not found");
    }

    // Verify workspace ownership
    const workspace = await ctx.db.get(project.workspaceId);
    if (!workspace || workspace.ownerId !== userId) {
      throw new Error("Unauthorized: No access to this project");
    }

    // Note: In a real implementation, you'd want to delete all related content
    // (articles, briefs, integrations, brand profiles, etc.)
    // For now, just delete the project

    await ctx.db.delete(id);
  },
});
