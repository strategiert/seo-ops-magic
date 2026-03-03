import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../auth";

// ── bodycamPages ─────────────────────────────────────────────────────────────

/** Alle Seiten-Snapshots abrufen */
export const listPages = query({
  args: {
    pageKey: v.optional(v.string()),
    lang: v.optional(v.string()),
  },
  handler: async (ctx, { pageKey, lang }) => {
    await requireAuth(ctx);

    if (pageKey && lang) {
      return await ctx.db
        .query("bodycamPages")
        .withIndex("by_page_lang", (q) =>
          q.eq("pageKey", pageKey).eq("lang", lang)
        )
        .collect();
    }

    const all = await ctx.db.query("bodycamPages").collect();

    if (pageKey) return all.filter((p) => p.pageKey === pageKey);
    if (lang) return all.filter((p) => p.lang === lang);
    return all;
  },
});

/** Alle dirty (unveroeffentlichten) Seiten */
export const listDirtyPages = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("bodycamPages")
      .withIndex("by_dirty", (q) => q.eq("isDirty", true))
      .collect();
  },
});

/** Einzelne Seite + Sprache */
export const getPage = query({
  args: { pageKey: v.string(), lang: v.string() },
  handler: async (ctx, { pageKey, lang }) => {
    await requireAuth(ctx);
    const results = await ctx.db
      .query("bodycamPages")
      .withIndex("by_page_lang", (q) =>
        q.eq("pageKey", pageKey).eq("lang", lang)
      )
      .first();
    return results ?? null;
  },
});

/** Seiten-Inhalt speichern (lokal, nicht publizieren) */
export const savePage = mutation({
  args: {
    pageKey: v.string(),
    lang: v.string(),
    contentJson: v.string(),
  },
  handler: async (ctx, { pageKey, lang, contentJson }) => {
    await requireAuth(ctx);

    const existing = await ctx.db
      .query("bodycamPages")
      .withIndex("by_page_lang", (q) =>
        q.eq("pageKey", pageKey).eq("lang", lang)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { contentJson, isDirty: true });
      return existing._id;
    } else {
      return await ctx.db.insert("bodycamPages", {
        pageKey,
        lang,
        contentJson,
        isDirty: true,
        importedAt: Date.now(),
      });
    }
  },
});

/** Nach erfolgreichem Publish: isDirty=false setzen */
export const markPagePublished = mutation({
  args: {
    pageKey: v.string(),
    lang: v.string(),
    commitSha: v.string(),
  },
  handler: async (ctx, { pageKey, lang, commitSha }) => {
    await requireAuth(ctx);

    const page = await ctx.db
      .query("bodycamPages")
      .withIndex("by_page_lang", (q) =>
        q.eq("pageKey", pageKey).eq("lang", lang)
      )
      .first();

    if (page) {
      await ctx.db.patch(page._id, {
        isDirty: false,
        lastPublishedAt: Date.now(),
        publishedCommit: commitSha,
      });
    }
  },
});

/** Interne Version für Actions (kein User-Auth nötig) */
export const upsertImportedPageInternal = internalMutation({
  args: {
    pageKey: v.string(),
    lang: v.string(),
    contentJson: v.string(),
  },
  handler: async (ctx, { pageKey, lang, contentJson }) => {
    const existing = await ctx.db
      .query("bodycamPages")
      .withIndex("by_page_lang", (q) =>
        q.eq("pageKey", pageKey).eq("lang", lang)
      )
      .first();

    if (existing) {
      if (!existing.isDirty) {
        await ctx.db.patch(existing._id, {
          contentJson,
          importedAt: Date.now(),
        });
      }
      return existing._id;
    } else {
      return await ctx.db.insert("bodycamPages", {
        pageKey,
        lang,
        contentJson,
        isDirty: false,
        importedAt: Date.now(),
      });
    }
  },
});

/** Seite aus GitHub-Import anlegen/aktualisieren */
export const upsertImportedPage = mutation({
  args: {
    pageKey: v.string(),
    lang: v.string(),
    contentJson: v.string(),
  },
  handler: async (ctx, { pageKey, lang, contentJson }) => {
    await requireAuth(ctx);

    const existing = await ctx.db
      .query("bodycamPages")
      .withIndex("by_page_lang", (q) =>
        q.eq("pageKey", pageKey).eq("lang", lang)
      )
      .first();

    if (existing) {
      // Nur updaten wenn nicht dirty (lokale Änderungen nicht überschreiben)
      if (!existing.isDirty) {
        await ctx.db.patch(existing._id, {
          contentJson,
          importedAt: Date.now(),
        });
      }
      return existing._id;
    } else {
      return await ctx.db.insert("bodycamPages", {
        pageKey,
        lang,
        contentJson,
        isDirty: false,
        importedAt: Date.now(),
      });
    }
  },
});

// ── bodycamMedia ─────────────────────────────────────────────────────────────

/** Alle Media-Einträge */
export const listMedia = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("bodycamMedia")
      .order("desc")
      .collect();
  },
});

/** Media-Eintrag speichern (nach erfolgreichem R2-Upload) */
export const saveMedia = mutation({
  args: {
    filename: v.string(),
    r2Key: v.string(),
    url: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    alt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Doppelter Upload verhindern
    const existing = await ctx.db
      .query("bodycamMedia")
      .withIndex("by_key", (q) => q.eq("r2Key", args.r2Key))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("bodycamMedia", {
      ...args,
      uploadedAt: Date.now(),
    });
  },
});

/** Interne Version für Actions (kein User-Auth nötig) */
export const saveMediaInternal = internalMutation({
  args: {
    filename: v.string(),
    r2Key: v.string(),
    url: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    alt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bodycamMedia")
      .withIndex("by_key", (q) => q.eq("r2Key", args.r2Key))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("bodycamMedia", {
      ...args,
      uploadedAt: Date.now(),
    });
  },
});

/** Alt-Text aktualisieren */
export const updateMediaAlt = mutation({
  args: { id: v.id("bodycamMedia"), alt: v.string() },
  handler: async (ctx, { id, alt }) => {
    await requireAuth(ctx);
    await ctx.db.patch(id, { alt });
  },
});

/** Media löschen */
export const deleteMedia = mutation({
  args: { id: v.id("bodycamMedia") },
  handler: async (ctx, { id }) => {
    await requireAuth(ctx);
    await ctx.db.delete(id);
  },
});
