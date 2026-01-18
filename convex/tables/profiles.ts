import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth, getAuthUserId } from "../auth";

/**
 * User profile queries and mutations
 *
 * Profiles store additional user data beyond what Clerk provides.
 * Each profile is linked to a Clerk user ID.
 */

/**
 * Get the current user's profile
 */
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
      .collect();

    return profiles[0] ?? null;
  },
});

/**
 * Get a profile by Clerk user ID
 */
export const getByClerkUserId = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", clerkUserId))
      .collect();

    return profiles[0] ?? null;
  },
});

/**
 * Create or update the current user's profile
 * Called after Clerk sign-up or when user updates their profile
 */
export const upsert = mutation({
  args: {
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const existingProfiles = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
      .collect();

    if (existingProfiles.length > 0) {
      // Update existing profile
      await ctx.db.patch(existingProfiles[0]._id, args);
      return existingProfiles[0]._id;
    } else {
      // Create new profile
      const profileId = await ctx.db.insert("profiles", {
        clerkUserId: userId,
        email: args.email,
        fullName: args.fullName,
        avatarUrl: args.avatarUrl,
      });

      // Also create a default workspace for the new user
      await ctx.db.insert("workspaces", {
        name: "Mein Workspace",
        ownerId: userId,
      });

      return profileId;
    }
  },
});

/**
 * Internal mutation to create profile from Clerk webhook
 * Called when a new user signs up via Clerk
 */
export const createFromWebhook = internalMutation({
  args: {
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if profile already exists
    const existingProfiles = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();

    if (existingProfiles.length > 0) {
      return existingProfiles[0]._id;
    }

    // Create new profile
    const profileId = await ctx.db.insert("profiles", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      fullName: args.fullName,
      avatarUrl: args.avatarUrl,
    });

    // Create default workspace for the new user
    await ctx.db.insert("workspaces", {
      name: "Mein Workspace",
      ownerId: args.clerkUserId,
    });

    return profileId;
  },
});

/**
 * Update the current user's profile
 */
export const update = mutation({
  args: {
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
      .collect();

    if (profiles.length === 0) {
      throw new Error("Profile not found");
    }

    await ctx.db.patch(profiles[0]._id, args);
    return profiles[0]._id;
  },
});
