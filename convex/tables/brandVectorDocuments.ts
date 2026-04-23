import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Brand Vector Document tracking.
 *
 * Each row maps one OpenAI vector-store file to a stable documentKey,
 * allowing the incremental sync to diff what's in the store vs. what the
 * brand's current crawl + articles contain.
 */

export const listByBrandProfileInternal = internalQuery({
  args: { brandProfileId: v.id("brandProfiles") },
  handler: async (ctx, { brandProfileId }) => {
    return await ctx.db
      .query("brandVectorDocuments")
      .withIndex("by_brand_profile", (q) =>
        q.eq("brandProfileId", brandProfileId)
      )
      .collect();
  },
});

export const upsertInternal = internalMutation({
  args: {
    brandProfileId: v.id("brandProfiles"),
    documentKey: v.string(),
    documentType: v.string(),
    openaiFileId: v.string(),
    contentHash: v.string(),
    title: v.optional(v.string()),
    contentPreview: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("brandVectorDocuments")
      .withIndex("by_brand_profile_key", (q) =>
        q.eq("brandProfileId", args.brandProfileId).eq("documentKey", args.documentKey)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        openaiFileId: args.openaiFileId,
        documentType: args.documentType,
        contentHash: args.contentHash,
        title: args.title,
        contentPreview: args.contentPreview,
        sourceUrl: args.sourceUrl,
        uploadedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("brandVectorDocuments", {
      brandProfileId: args.brandProfileId,
      documentKey: args.documentKey,
      documentType: args.documentType,
      openaiFileId: args.openaiFileId,
      contentHash: args.contentHash,
      title: args.title,
      contentPreview: args.contentPreview,
      sourceUrl: args.sourceUrl,
      uploadedAt: Date.now(),
    });
  },
});

export const deleteByIdInternal = internalMutation({
  args: { id: v.id("brandVectorDocuments") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
