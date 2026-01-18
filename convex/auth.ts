import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

/**
 * Authentication utilities for Convex functions
 *
 * These helpers extract the authenticated user from the context
 * and provide consistent auth checking across all functions.
 */

/**
 * Get the authenticated Clerk user ID from context
 * Returns null if not authenticated
 */
export async function getAuthUserId(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  // Clerk stores the user ID in the 'subject' field
  return identity.subject;
}

/**
 * Require authentication - throws if not authenticated
 * Use this in mutations/queries that require auth
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthorized: Authentication required");
  }
  return userId;
}

/**
 * Check if user owns a workspace
 */
export async function requireWorkspaceOwner(
  ctx: QueryCtx | MutationCtx,
  workspaceId: string
): Promise<string> {
  const userId = await requireAuth(ctx);

  const workspace = await ctx.db.get(workspaceId as any);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  if ((workspace as any).ownerId !== userId) {
    throw new Error("Unauthorized: Not workspace owner");
  }

  return userId;
}

/**
 * Check if user has access to a project (via workspace ownership)
 */
export async function requireProjectAccess(
  ctx: QueryCtx | MutationCtx,
  projectId: string
): Promise<string> {
  const userId = await requireAuth(ctx);

  const project = await ctx.db.get(projectId as any);
  if (!project) {
    throw new Error("Project not found");
  }

  const workspace = await ctx.db.get((project as any).workspaceId);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  if ((workspace as any).ownerId !== userId) {
    throw new Error("Unauthorized: No access to this project");
  }

  return userId;
}
