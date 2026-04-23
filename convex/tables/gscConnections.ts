import { query, mutation, internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Per-project binding of a Google account + a GSC property.
 * One binding per project (max). When the user picks a different
 * account/property combo, we overwrite in place.
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

/** Get the current project's GSC binding (with denormalized account email). */
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await requireAuth(ctx);
    if (!(await verifyProjectAccess(ctx, projectId, userId))) return null;

    const binding = await ctx.db
      .query("gscConnections")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    if (!binding) return null;

    const account = await ctx.db.get(binding.googleAccountId);
    return {
      _id: binding._id,
      projectId: binding.projectId,
      googleAccountId: binding.googleAccountId,
      googleAccountEmail: account?.email ?? null,
      gscProperty: binding.gscProperty,
      propertyPermissionLevel: binding.propertyPermissionLevel,
      connectedAt: binding.connectedAt,
    };
  },
});

export const upsert = mutation({
  args: {
    projectId: v.id("projects"),
    googleAccountId: v.id("googleAccounts"),
    gscProperty: v.string(),
    propertyPermissionLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (!(await verifyProjectAccess(ctx, args.projectId, userId))) {
      throw new Error("Unauthorized: no access to this project");
    }
    // Verify account belongs to the current user
    const account = await ctx.db.get(args.googleAccountId);
    if (!account || account.userId !== userId) {
      throw new Error("Google account not found");
    }

    const existing = await ctx.db
      .query("gscConnections")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        googleAccountId: args.googleAccountId,
        gscProperty: args.gscProperty,
        propertyPermissionLevel: args.propertyPermissionLevel,
        connectedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("gscConnections", {
      projectId: args.projectId,
      googleAccountId: args.googleAccountId,
      gscProperty: args.gscProperty,
      propertyPermissionLevel: args.propertyPermissionLevel,
      connectedAt: Date.now(),
    });
  },
});

export const disconnect = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await requireAuth(ctx);
    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      throw new Error("Unauthorized");
    }
    const existing = await ctx.db
      .query("gscConnections")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

// ─── Internal helpers for scheduled gsc fetches ─────────────────────────

export const getByProjectInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("gscConnections")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
  },
});
