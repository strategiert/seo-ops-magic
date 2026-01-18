import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Workspace queries and mutations
 *
 * Workspaces are organizational containers that group projects.
 * Each workspace has a single owner (the Clerk user who created it).
 */

/**
 * List all workspaces owned by the current user
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

    return await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
  },
});

/**
 * Get a single workspace by ID
 * Only returns if user owns the workspace
 */
export const get = query({
  args: { id: v.id("workspaces") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const workspace = await ctx.db.get(id);
    if (!workspace) {
      return null;
    }

    // Only return if user owns this workspace
    if (workspace.ownerId !== userId) {
      return null;
    }

    return workspace;
  },
});

/**
 * Create a new workspace
 * Automatically assigns the current user as owner
 */
export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, { name }) => {
    const userId = await requireAuth(ctx);

    const workspaceId = await ctx.db.insert("workspaces", {
      name,
      ownerId: userId,
    });

    return workspaceId;
  },
});

/**
 * Update a workspace
 * Only the owner can update
 */
export const update = mutation({
  args: {
    id: v.id("workspaces"),
    name: v.string(),
  },
  handler: async (ctx, { id, name }) => {
    const userId = await requireAuth(ctx);

    const workspace = await ctx.db.get(id);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (workspace.ownerId !== userId) {
      throw new Error("Unauthorized: Not workspace owner");
    }

    await ctx.db.patch(id, { name });
    return id;
  },
});

/**
 * Delete a workspace
 * Only the owner can delete
 * Note: This will cascade delete all projects in the workspace
 */
export const remove = mutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const workspace = await ctx.db.get(id);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (workspace.ownerId !== userId) {
      throw new Error("Unauthorized: Not workspace owner");
    }

    // Delete all projects in this workspace first
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", id))
      .collect();

    for (const project of projects) {
      await ctx.db.delete(project._id);
    }

    // Delete the workspace
    await ctx.db.delete(id);
  },
});
