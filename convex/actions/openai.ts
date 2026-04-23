"use node";
import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

/**
 * OpenAI Vector Store sync.
 *
 * The vector store holds the full crawled brand corpus so downstream
 * content generation can retrieve and cite arbitrary passages of the
 * original website. It contains:
 *   - _brand_profile.md      — the structured brand profile overview
 *   - page_<NNN>_<slug>.md   — one file per crawled page, with the
 *                              page's original Markdown content intact
 *
 * Runs automatically at the end of brand analysis (scheduled from
 * gemini.analyzeBrandInternal). Also exposed as a public action for
 * manual re-sync.
 *
 * Strategy: clean slate per sync — delete the previous vector store for
 * this brand (if any), re-upload everything, create a fresh vector
 * store, store its ID on the brand profile. Keeps the retrieval index
 * in sync with the latest crawl + analysis without incremental diffing.
 *
 * Scope: one brand profile → one vector store, keyed in
 * `brandProfiles.openaiVectorStoreId`.
 */

const OPENAI_FILES_URL = "https://api.openai.com/v1/files";
const OPENAI_VS_URL = "https://api.openai.com/v1/vector_stores";
const OPENAI_BETA_HEADER = "assistants=v2";

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

async function createVectorStore(
  apiKey: string,
  name: string,
  fileIds: string[]
): Promise<string> {
  const res = await fetch(OPENAI_VS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": OPENAI_BETA_HEADER,
    },
    body: JSON.stringify({ name, file_ids: fileIds }),
  });
  if (!res.ok) {
    throw new Error(
      `OpenAI vector store create failed (${res.status}): ${await res.text()}`
    );
  }
  const data: any = await res.json();
  return data.id as string;
}

async function deleteVectorStoreSafe(apiKey: string, vsId: string): Promise<void> {
  try {
    await fetch(`${OPENAI_VS_URL}/${vsId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": OPENAI_BETA_HEADER,
      },
    });
  } catch (err) {
    console.warn(`Failed to delete old vector store ${vsId}:`, err);
  }
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

/**
 * Turn the structured brand profile into a single overview document.
 */
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

function slugFromUrl(url: string, fallbackIndex: number): string {
  try {
    const u = new URL(url);
    const raw =
      u.pathname === "/" || u.pathname === ""
        ? "homepage"
        : u.pathname.replace(/^\/+|\/+$/g, "").replace(/\//g, "_");
    const slug = raw.replace(/[^a-zA-Z0-9_-]+/g, "-").substring(0, 60);
    return slug || `page_${fallbackIndex}`;
  } catch {
    return `page_${fallbackIndex}`;
  }
}

/**
 * Build the full document set: 1 brand-profile overview + N crawled pages.
 */
function renderDocs(
  profile: BrandDocFields,
  crawlPages: CrawlPage[]
): Array<{ filename: string; content: string }> {
  const docs: Array<{ filename: string; content: string }> = [];

  // 1) Brand profile overview
  docs.push({
    filename: "_brand_profile.md",
    content: renderBrandProfileDoc(profile),
  });

  // 2) One doc per crawled page, most relevant first
  const sorted = [...crawlPages].sort(
    (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0)
  );
  let index = 0;
  for (const page of sorted) {
    if (!page.contentMarkdown || page.contentMarkdown.trim().length < 40) continue;
    index += 1;
    const slug = slugFromUrl(page.url, index);
    const filename = `page_${String(index).padStart(3, "0")}_${slug}.md`;
    const header: string[] = [
      `# ${page.title ?? page.url}`,
      `URL: ${page.url}`,
    ];
    if (page.pageType) header.push(`Typ: ${page.pageType}`);
    if (page.metaDescription) header.push(`Meta: ${page.metaDescription}`);
    docs.push({
      filename,
      content: `${header.join("\n")}\n\n---\n\n${page.contentMarkdown}`,
    });
  }

  return docs;
}

/**
 * Internal action — sync brand profile to OpenAI vector store.
 * Idempotent: deletes previous vector store, creates fresh.
 */
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
    if (!profile) {
      return { success: false, error: "Brand profile not found" };
    }

    const crawlPages = (await ctx.runQuery(
      internal.tables.brandCrawlData.listByBrandProfileInternal,
      { brandProfileId }
    )) as CrawlPage[];

    const docs = renderDocs(profile, crawlPages);
    if (docs.length === 0) {
      return { success: false, error: "No brand data to sync" };
    }

    try {
      // Delete previous vector store (if any) so we don't leak old files.
      if (profile.openaiVectorStoreId) {
        await deleteVectorStoreSafe(apiKey, profile.openaiVectorStoreId);
      }

      // Upload all docs. Chunked 5 parallel to avoid OpenAI file-upload bursts.
      const fileIds: string[] = [];
      const CHUNK = 5;
      for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = docs.slice(i, i + CHUNK);
        const uploads = await Promise.allSettled(
          batch.map((d) => uploadFile(apiKey, d.filename, d.content))
        );
        for (let j = 0; j < uploads.length; j++) {
          const r = uploads[j];
          if (r.status === "fulfilled") {
            fileIds.push(r.value);
          } else {
            console.error(
              `Upload ${batch[j].filename} failed:`,
              r.reason instanceof Error ? r.reason.message : r.reason
            );
          }
        }
      }

      if (fileIds.length === 0) {
        throw new Error("All file uploads failed");
      }

      // Create fresh vector store
      const vsName = `brand_${brandProfileId}_${Date.now()}`;
      const vsId = await createVectorStore(apiKey, vsName, fileIds);

      // Persist VS id on the profile
      await ctx.runMutation(internal.tables.brandProfiles.internalUpdate, {
        id: brandProfileId,
        updates: { openaiVectorStoreId: vsId },
      });

      return {
        success: true,
        vectorStoreId: vsId,
        docsUploaded: fileIds.length,
        docsAttempted: docs.length,
        pagesIncluded: crawlPages.length,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Vector store sync failed:", message);
      return { success: false, error: message };
    }
  },
});

/**
 * Public action — manual re-sync trigger. Usually not needed: the sync runs
 * automatically at the end of brand analysis. Kept for explicit user-driven
 * resyncs from the UI.
 */
export const syncVectorStore = action({
  args: {
    projectId: v.id("projects"),
    brandProfileId: v.id("brandProfiles"),
  },
  handler: async (
    ctx,
    { projectId, brandProfileId }
  ): Promise<{ success: boolean; error?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { success: false, error: "Unauthorized" };

    // Verify access (via public query — has requireAuth built in)
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
