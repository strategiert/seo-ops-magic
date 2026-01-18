import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

/**
 * Content Brief queries and mutations
 *
 * Content briefs are SEO specifications that define what an article should cover.
 * They contain keywords, target audience, tone, and NeuronWriter guidelines.
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
 * List all content briefs for a project
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

    const briefs = await ctx.db
      .query("contentBriefs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    if (status) {
      return briefs.filter((b) => b.status === status);
    }

    return briefs;
  },
});

/**
 * Get a single content brief by ID
 */
export const get = query({
  args: { id: v.id("contentBriefs") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const brief = await ctx.db.get(id);
    if (!brief) return null;

    if (!(await verifyProjectAccess(ctx, brief.projectId, userId))) {
      return null;
    }

    return brief;
  },
});

/**
 * Get brief with related project and brand profile
 */
export const getWithContext = query({
  args: { id: v.id("contentBriefs") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const brief = await ctx.db.get(id);
    if (!brief) return null;

    if (!(await verifyProjectAccess(ctx, brief.projectId, userId))) {
      return null;
    }

    const project = await ctx.db.get(brief.projectId);

    // Get brand profile for project
    const brandProfiles = await ctx.db
      .query("brandProfiles")
      .withIndex("by_project", (q) => q.eq("projectId", brief.projectId))
      .collect();

    return {
      ...brief,
      project,
      brandProfile: brandProfiles[0] ?? null,
    };
  },
});

/**
 * Create a new content brief
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    primaryKeyword: v.string(),
    status: v.optional(v.string()),
    searchIntent: v.optional(v.string()),
    targetAudience: v.optional(v.string()),
    tonality: v.optional(v.string()),
    targetLength: v.optional(v.number()),
    priorityScore: v.optional(v.number()),
    notes: v.optional(v.string()),
    nwQueryId: v.optional(v.string()),
    nwGuidelines: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (!(await verifyProjectAccess(ctx, args.projectId, userId))) {
      throw new Error("Unauthorized: No access to this project");
    }

    return await ctx.db.insert("contentBriefs", {
      projectId: args.projectId,
      title: args.title,
      primaryKeyword: args.primaryKeyword,
      status: args.status ?? "draft",
      searchIntent: args.searchIntent,
      targetAudience: args.targetAudience,
      tonality: args.tonality,
      targetLength: args.targetLength,
      priorityScore: args.priorityScore ?? 50,
      notes: args.notes,
      nwQueryId: args.nwQueryId,
      nwGuidelines: args.nwGuidelines,
    });
  },
});

/**
 * Update a content brief
 */
export const update = mutation({
  args: {
    id: v.id("contentBriefs"),
    title: v.optional(v.string()),
    primaryKeyword: v.optional(v.string()),
    status: v.optional(v.string()),
    searchIntent: v.optional(v.string()),
    targetAudience: v.optional(v.string()),
    tonality: v.optional(v.string()),
    targetLength: v.optional(v.number()),
    priorityScore: v.optional(v.number()),
    notes: v.optional(v.string()),
    nwQueryId: v.optional(v.string()),
    nwGuidelines: v.optional(v.any()),
    researchPack: v.optional(v.any()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const userId = await requireAuth(ctx);

    const brief = await ctx.db.get(id);
    if (!brief) {
      throw new Error("Content brief not found");
    }

    if (!(await verifyProjectAccess(ctx, brief.projectId, userId))) {
      throw new Error("Unauthorized");
    }

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
 * Delete a content brief
 */
export const remove = mutation({
  args: { id: v.id("contentBriefs") },
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);

    const brief = await ctx.db.get(id);
    if (!brief) {
      throw new Error("Content brief not found");
    }

    if (!(await verifyProjectAccess(ctx, brief.projectId, userId))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(id);
  },
});
