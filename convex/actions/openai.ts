"use node";
import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import * as crypto from "node:crypto";

/**
 * OpenAI Vector Store sync.
 *
 * The vector store holds the full brand corpus so downstream content
 * generation can retrieve and cite arbitrary passages. It contains:
 *   - _brand_profile.md          — structured brand profile overview
 *   - page_<NNN>_<slug>.md       — one file per crawled page
 *   - article_<NNN>_<slug>.md    — one file per published article
 *
 * Sync is **incremental**:
 *   - Each document has a stable `documentKey` and a content hash.
 *   - On re-sync we diff the current set against what is already in the
 *     store: only changed/new docs are re-embedded; deleted docs are
 *     removed. Unchanged docs stay as-is (saves OpenAI cost + avoids
 *     downtime for retrieval queries that might run concurrently).
 *
 * Triggered automatically by:
 *   - analyzeBrandInternal (at end of brand analysis)
 *   - articles.update (when a draft flips to "published")
 *
 * Scope: one brand profile → one vector store, ID on
 * `brandProfiles.openaiVectorStoreId`.
 */

const OPENAI_FILES_URL = "https://api.openai.com/v1/files";
const OPENAI_VS_URL = "https://api.openai.com/v1/vector_stores";
const OPENAI_BETA_HEADER = "assistants=v2";

// ──────────────────────────────────────────────────────────── OpenAI REST

async function uploadFile(
  apiKey: string,
  filename: string,
  content: string
): Promise<string> {
  const form = new FormData();
  form.append("purpose", "assistants");
  form.append(
    "file",
    new Blob([content], { type: "text/markdown" }),
    filename
  );
  const res = await fetch(OPENAI_FILES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(
      `OpenAI file upload failed (${res.status}): ${await res.text()}`
    );
  }
  const data: any = await res.json();
  return data.id as string;
}

async function deleteFileSafe(apiKey: string, fileId: string): Promise<void> {
  try {
    await fetch(`${OPENAI_FILES_URL}/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (err) {
    console.warn(`OpenAI file delete ${fileId} failed:`, err);
  }
}

async function createVectorStore(
  apiKey: string,
  name: string
): Promise<string> {
  const res = await fetch(OPENAI_VS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": OPENAI_BETA_HEADER,
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(
      `OpenAI vector store create failed (${res.status}): ${await res.text()}`
    );
  }
  const data: any = await res.json();
  return data.id as string;
}

async function attachFileToVectorStore(
  apiKey: string,
  vsId: string,
  fileId: string
): Promise<void> {
  const res = await fetch(`${OPENAI_VS_URL}/${vsId}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": OPENAI_BETA_HEADER,
    },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!res.ok) {
    throw new Error(
      `Attach ${fileId} → ${vsId} failed (${res.status}): ${await res.text()}`
    );
  }
}

async function detachFileFromVectorStoreSafe(
  apiKey: string,
  vsId: string,
  fileId: string
): Promise<void> {
  try {
    await fetch(`${OPENAI_VS_URL}/${vsId}/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": OPENAI_BETA_HEADER,
      },
    });
  } catch (err) {
    console.warn(`Detach ${fileId} from ${vsId} failed:`, err);
  }
}

async function verifyVectorStoreExists(
  apiKey: string,
  vsId: string
): Promise<boolean> {
  try {
    const res = await fetch(`${OPENAI_VS_URL}/${vsId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": OPENAI_BETA_HEADER,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────── Content helpers

function hashContent(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex").substring(0, 16);
}

function slugFromUrl(url: string, fallback: string): string {
  try {
    const u = new URL(url);
    const raw =
      u.pathname === "/" || u.pathname === ""
        ? "homepage"
        : u.pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "_");
    const slug = raw.replace(/[^a-zA-Z0-9_-]+/g, "-").substring(0, 60);
    return slug || fallback;
  } catch {
    return fallback;
  }
}

function slugify(s: string, max = 60): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, max) || "untitled"
  );
}

interface BrandDocFields {
  brandName?: string;
  tagline?: string;
  missionStatement?: string;
  brandStory?: string;
  brandVoice?: any;
  products?: any;
  services?: any;
  personas?: any;
  brandKeywords?: any;
  competitors?: any;
  visualIdentity?: any;
  internalLinks?: any;
}

interface CrawlPage {
  url: string;
  title?: string;
  pageType?: string;
  contentMarkdown?: string;
  metaDescription?: string;
  headings?: string[];
  relevanceScore?: number;
}

interface PublishedArticle {
  _id: string;
  title: string;
  primaryKeyword?: string;
  contentMarkdown?: string;
  metaTitle?: string;
  metaDescription?: string;
  _creationTime: number;
}

interface Doc {
  key: string;           // stable identifier, e.g. "brand_profile"
  type: "brand_profile" | "page" | "article";
  filename: string;      // display name in OpenAI dashboard
  content: string;       // full markdown body
  title?: string;
  sourceUrl?: string;
}

function renderBrandProfileDoc(profile: BrandDocFields): string {
  const brand = profile.brandName || "Brand";
  const parts: string[] = [`# ${brand} — Brand Profile`];

  if (profile.tagline) parts.push(`**Tagline:** ${profile.tagline}`);
  if (profile.missionStatement)
    parts.push(`## Mission\n${profile.missionStatement}`);
  if (profile.brandStory) parts.push(`## Story\n${profile.brandStory}`);

  if (profile.brandVoice) {
    const v = profile.brandVoice;
    const voiceParts: string[] = ["## Brand Voice"];
    if (Array.isArray(v.tone) && v.tone.length)
      voiceParts.push(`**Tonalität:** ${v.tone.join(", ")}`);
    if (Array.isArray(v.personality_traits) && v.personality_traits.length)
      voiceParts.push(`**Persönlichkeit:** ${v.personality_traits.join(", ")}`);
    const ws = v.writing_style ?? {};
    const styleLines: string[] = [];
    if (ws.formality) styleLines.push(`- Formalität: ${ws.formality}`);
    if (ws.sentence_length) styleLines.push(`- Satzlänge: ${ws.sentence_length}`);
    if (ws.vocabulary_level)
      styleLines.push(`- Vokabular: ${ws.vocabulary_level}`);
    if (ws.use_of_jargon) styleLines.push(`- Jargon: ${ws.use_of_jargon}`);
    if (styleLines.length)
      voiceParts.push(`### Schreibstil\n${styleLines.join("\n")}`);
    if (voiceParts.length > 1) parts.push(voiceParts.join("\n\n"));
  }

  if (Array.isArray(profile.products) && profile.products.length) {
    const prodParts: string[] = ["## Produkte"];
    for (const p of profile.products) {
      prodParts.push(
        `### ${p.name}\n${p.description ?? ""}${
          Array.isArray(p.features) && p.features.length
            ? `\n**Features:** ${p.features.join(", ")}`
            : ""
        }`
      );
    }
    parts.push(prodParts.join("\n\n"));
  }

  if (Array.isArray(profile.services) && profile.services.length) {
    const servParts: string[] = ["## Leistungen"];
    for (const s of profile.services) {
      servParts.push(
        `### ${s.name}\n${s.description ?? ""}${
          s.target_audience ? `\n**Zielgruppe:** ${s.target_audience}` : ""
        }`
      );
    }
    parts.push(servParts.join("\n\n"));
  }

  if (Array.isArray(profile.personas) && profile.personas.length) {
    const personaParts: string[] = ["## Zielgruppen / Personas"];
    for (const p of profile.personas) {
      personaParts.push(
        `### ${p.name}\n${p.demographics ?? ""}\n**Pain Points:** ${
          Array.isArray(p.pain_points) ? p.pain_points.join(", ") : ""
        }\n**Ziele:** ${
          Array.isArray(p.goals) ? p.goals.join(", ") : ""
        }`
      );
    }
    parts.push(personaParts.join("\n\n"));
  }

  if (profile.brandKeywords) {
    const kw = profile.brandKeywords;
    const kwParts: string[] = ["## Keyword-Universum"];
    if (Array.isArray(kw.primary) && kw.primary.length)
      kwParts.push(`**Primary:** ${kw.primary.join(", ")}`);
    if (Array.isArray(kw.secondary) && kw.secondary.length)
      kwParts.push(`**Secondary:** ${kw.secondary.join(", ")}`);
    if (Array.isArray(kw.long_tail) && kw.long_tail.length)
      kwParts.push(`**Long-Tail:** ${kw.long_tail.join(", ")}`);
    if (kwParts.length > 1) parts.push(kwParts.join("\n\n"));
  }

  if (Array.isArray(profile.competitors) && profile.competitors.length) {
    const compParts: string[] = ["## Wettbewerber"];
    for (const c of profile.competitors) {
      const strengths =
        Array.isArray(c.strengths) && c.strengths.length
          ? `\n**Stärken:** ${c.strengths.join(", ")}`
          : "";
      const weaknesses =
        Array.isArray(c.weaknesses) && c.weaknesses.length
          ? `\n**Schwächen:** ${c.weaknesses.join(", ")}`
          : "";
      compParts.push(
        `### ${c.name}${c.domain ? ` (${c.domain})` : ""}${strengths}${weaknesses}`
      );
    }
    parts.push(compParts.join("\n\n"));
  }

  return parts.join("\n\n");
}

function buildDocs(
  profile: BrandDocFields,
  crawlPages: CrawlPage[],
  articles: PublishedArticle[]
): Doc[] {
  const docs: Doc[] = [];

  // 1) Structured brand profile
  docs.push({
    key: "brand_profile",
    type: "brand_profile",
    filename: "_brand_profile.md",
    content: renderBrandProfileDoc(profile),
    title: profile.brandName || "Brand Profile",
  });

  // 2) Crawled pages (one per URL, stable key = URL hash)
  const sortedPages = [...crawlPages].sort(
    (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0)
  );
  let pageIdx = 0;
  for (const page of sortedPages) {
    if (!page.contentMarkdown || page.contentMarkdown.trim().length < 40) continue;
    pageIdx += 1;
    const slug = slugFromUrl(page.url, `page_${pageIdx}`);
    const urlKey = hashContent(page.url);
    const header: string[] = [
      `# ${page.title ?? page.url}`,
      `URL: ${page.url}`,
    ];
    if (page.pageType) header.push(`Typ: ${page.pageType}`);
    if (page.metaDescription) header.push(`Meta: ${page.metaDescription}`);
    docs.push({
      key: `page_${urlKey}`,
      type: "page",
      filename: `page_${String(pageIdx).padStart(3, "0")}_${slug}.md`,
      content: `${header.join("\n")}\n\n---\n\n${page.contentMarkdown}`,
      title: page.title,
      sourceUrl: page.url,
    });
  }

  // 3) Published articles (one per article, stable key = articleId)
  const sortedArticles = [...articles].sort(
    (a, b) => b._creationTime - a._creationTime
  );
  let articleIdx = 0;
  for (const article of sortedArticles) {
    if (!article.contentMarkdown || article.contentMarkdown.trim().length < 40)
      continue;
    articleIdx += 1;
    const slug = slugify(article.title);
    const header: string[] = [
      `# ${article.title}`,
      `Article ID: ${article._id}`,
    ];
    if (article.primaryKeyword)
      header.push(`Primary Keyword: ${article.primaryKeyword}`);
    if (article.metaDescription) header.push(`Meta: ${article.metaDescription}`);
    docs.push({
      key: `article_${article._id}`,
      type: "article",
      filename: `article_${String(articleIdx).padStart(3, "0")}_${slug}.md`,
      content: `${header.join("\n")}\n\n---\n\n${article.contentMarkdown}`,
      title: article.title,
    });
  }

  return docs;
}

// ──────────────────────────────────────────────────────────────── Sync

export const syncVectorStoreInternal = internalAction({
  args: { brandProfileId: v.id("brandProfiles") },
  handler: async (ctx, { brandProfileId }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("OPENAI_API_KEY not set — skipping vector store sync");
      return { success: false, error: "OPENAI_API_KEY not configured" };
    }

    const profile = await ctx.runQuery(
      internal.tables.brandProfiles.getInternal,
      { id: brandProfileId }
    );
    if (!profile) return { success: false, error: "Brand profile not found" };

    const crawlPages = (await ctx.runQuery(
      internal.tables.brandCrawlData.listByBrandProfileInternal,
      { brandProfileId }
    )) as CrawlPage[];

    const publishedArticles = (await ctx.runQuery(
      internal.tables.articles.listPublishedByProjectInternal,
      { projectId: profile.projectId }
    )) as PublishedArticle[];

    const existingDocs = await ctx.runQuery(
      internal.tables.brandVectorDocuments.listByBrandProfileInternal,
      { brandProfileId }
    );
    const existingByKey = new Map(
      existingDocs.map((d: any) => [d.documentKey, d])
    );

    const currentDocs = buildDocs(profile, crawlPages, publishedArticles);
    const currentKeys = new Set(currentDocs.map((d) => d.key));

    // Classify what needs to happen
    const toAdd: Doc[] = [];
    const toUpdate: Array<{ doc: Doc; oldFileId: string; existingRowId: string }> = [];
    const toRemove: Array<{ id: string; openaiFileId: string }> = [];
    let unchanged = 0;

    for (const doc of currentDocs) {
      const newHash = hashContent(doc.content);
      const existing = existingByKey.get(doc.key);
      if (!existing) {
        toAdd.push(doc);
      } else if (existing.contentHash !== newHash) {
        toUpdate.push({
          doc,
          oldFileId: existing.openaiFileId,
          existingRowId: existing._id,
        });
      } else {
        unchanged += 1;
      }
    }
    for (const [key, existing] of existingByKey) {
      if (!currentKeys.has(key)) {
        toRemove.push({ id: (existing as any)._id, openaiFileId: (existing as any).openaiFileId });
      }
    }

    // Ensure vector store exists
    let vsId = profile.openaiVectorStoreId;
    if (vsId) {
      const ok = await verifyVectorStoreExists(apiKey, vsId);
      if (!ok) vsId = undefined;
    }
    if (!vsId) {
      const vsName = `brand_${brandProfileId}_${Date.now()}`;
      vsId = await createVectorStore(apiKey, vsName);
      await ctx.runMutation(internal.tables.brandProfiles.internalUpdate, {
        id: brandProfileId,
        updates: { openaiVectorStoreId: vsId },
      });
    }

    const report = {
      vsId,
      added: 0,
      updated: 0,
      removed: 0,
      unchanged,
      failed: 0,
    };

    // Removals
    for (const item of toRemove) {
      try {
        await detachFileFromVectorStoreSafe(apiKey, vsId, item.openaiFileId);
        await deleteFileSafe(apiKey, item.openaiFileId);
        await ctx.runMutation(
          internal.tables.brandVectorDocuments.deleteByIdInternal,
          { id: item.id as any }
        );
        report.removed += 1;
      } catch (err) {
        console.error("Remove failed:", err);
        report.failed += 1;
      }
    }

    // Updates (replace): upload new → attach → detach+delete old → upsert row
    for (const item of toUpdate) {
      try {
        const newFileId = await uploadFile(
          apiKey,
          item.doc.filename,
          item.doc.content
        );
        await attachFileToVectorStore(apiKey, vsId, newFileId);
        await detachFileFromVectorStoreSafe(apiKey, vsId, item.oldFileId);
        await deleteFileSafe(apiKey, item.oldFileId);
        await ctx.runMutation(
          internal.tables.brandVectorDocuments.upsertInternal,
          {
            brandProfileId,
            documentKey: item.doc.key,
            documentType: item.doc.type,
            openaiFileId: newFileId,
            contentHash: hashContent(item.doc.content),
            title: item.doc.title,
            contentPreview: item.doc.content.slice(0, 500),
            sourceUrl: item.doc.sourceUrl,
          }
        );
        report.updated += 1;
      } catch (err) {
        console.error(`Update ${item.doc.key} failed:`, err);
        report.failed += 1;
      }
    }

    // Additions — chunked 5 parallel to stay under OpenAI burst limits
    const CHUNK = 5;
    for (let i = 0; i < toAdd.length; i += CHUNK) {
      const batch = toAdd.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        batch.map(async (doc) => {
          const fileId = await uploadFile(apiKey, doc.filename, doc.content);
          await attachFileToVectorStore(apiKey, vsId!, fileId);
          await ctx.runMutation(
            internal.tables.brandVectorDocuments.upsertInternal,
            {
              brandProfileId,
              documentKey: doc.key,
              documentType: doc.type,
              openaiFileId: fileId,
              contentHash: hashContent(doc.content),
              title: doc.title,
              contentPreview: doc.content.slice(0, 500),
              sourceUrl: doc.sourceUrl,
            }
          );
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") report.added += 1;
        else {
          console.error("Add failed:", r.reason);
          report.failed += 1;
        }
      }
    }

    return { success: true, ...report };
  },
});

/**
 * Public action — manual re-sync trigger. Not normally needed; analysis and
 * article-publish both auto-trigger the sync.
 */
export const syncVectorStore = action({
  args: {
    projectId: v.id("projects"),
    brandProfileId: v.id("brandProfiles"),
  },
  handler: async (
    ctx,
    { brandProfileId }
  ): Promise<{ success: boolean; error?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Unauthorized" };

    const profile = await ctx.runQuery(api.tables.brandProfiles.get, {
      id: brandProfileId,
    });
    if (!profile) return { success: false, error: "Brand profile not found" };

    await ctx.scheduler.runAfter(
      0,
      internal.actions.openai.syncVectorStoreInternal,
      { brandProfileId }
    );
    return { success: true };
  },
});
