import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Integration queries and mutations
 *
 * Integrations store credentials for external services:
 * - NeuronWriter (SEO optimization)
 * - WordPress (publishing)
 * - Google Search Console (analytics)
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
 * List all integrations for a project
 */
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      return [];
    }

    return await ctx.db
      .query("integrations")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

/**
 * Get a specific integration by project and type
 */
export const getByProjectType = query({
  args: {
    projectId: v.id("projects"),
    type: v.string(),
  },
  handler: async (ctx, { projectId, type }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      return [];
    }

    return await ctx.db
      .query("integrations")
      .withIndex("by_project_type", (q) =>
        q.eq("projectId", projectId).eq("type", type)
      )
      .collect();
  },
});

/**
 * Create or update a NeuronWriter integration
 */
export const upsertNeuronWriter = mutation({
  args: {
    projectId: v.id("projects"),
    nwProjectId: v.string(),
    nwProjectName: v.optional(v.string()),
    nwLanguage: v.optional(v.string()),
    nwEngine: v.optional(v.string()),
    credentialsEncrypted: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, args.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    // Check if integration exists
    const existing = await ctx.db
      .query("integrations")
      .withIndex("by_project_type", (q) =>
        q.eq("projectId", args.projectId).eq("type", "neuronwriter")
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        nwProjectId: args.nwProjectId,
        nwProjectName: args.nwProjectName,
        nwLanguage: args.nwLanguage ?? "de",
        nwEngine: args.nwEngine ?? "google.de",
        credentialsEncrypted: args.credentialsEncrypted,
        isConnected: true,
        lastSyncAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("integrations", {
      projectId: args.projectId,
      type: "neuronwriter",
      nwProjectId: args.nwProjectId,
      nwProjectName: args.nwProjectName,
      nwLanguage: args.nwLanguage ?? "de",
      nwEngine: args.nwEngine ?? "google.de",
      credentialsEncrypted: args.credentialsEncrypted,
      isConnected: true,
      lastSyncAt: Date.now(),
    });
  },
});

/**
 * Create or update a WordPress integration
 */
export const upsertWordPress = mutation({
  args: {
    projectId: v.id("projects"),
    wpUsername: v.string(),
    wpAppPassword: v.string(),
    wpSiteName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, args.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    // Check if integration exists
    const existing = await ctx.db
      .query("integrations")
      .withIndex("by_project_type", (q) =>
        q.eq("projectId", args.projectId).eq("type", "wordpress")
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        wpUsername: args.wpUsername,
        wpAppPassword: args.wpAppPassword,
        wpSiteName: args.wpSiteName,
        isConnected: true,
        wpIsVerified: false, // Will be verified on first successful publish
      });
      return existing._id;
    }

    return await ctx.db.insert("integrations", {
      projectId: args.projectId,
      type: "wordpress",
      wpUsername: args.wpUsername,
      wpAppPassword: args.wpAppPassword,
      wpSiteName: args.wpSiteName,
      isConnected: true,
      wpIsVerified: false,
    });
  },
});

/**
 * Update last sync time for an integration
 */
export const updateSyncTime = mutation({
  args: { id: v.id("integrations") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const integration = await ctx.db.get(id);
    if (!integration) {
      throw new Error("Integration not found");
    }

    if (!(await verifyProjectAccess(ctx, integration.projectId, userId))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(id, { lastSyncAt: Date.now() });
  },
});

/**
 * Mark WordPress integration as verified
 */
export const markWordPressVerified = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, projectId, userId))) {
      throw new Error("Unauthorized");
    }

    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_project_type", (q) =>
        q.eq("projectId", projectId).eq("type", "wordpress")
      )
      .first();

    if (integration) {
      await ctx.db.patch(integration._id, { wpIsVerified: true });
    }
  },
});

/**
 * Delete an integration
 */
export const remove = mutation({
  args: { id: v.id("integrations") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const integration = await ctx.db.get(id);
    if (!integration) {
      throw new Error("Integration not found");
    }

    if (!(await verifyProjectAccess(ctx, integration.projectId, userId))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(id);
  },
});
