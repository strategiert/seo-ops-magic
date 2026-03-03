import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

const GITHUB_REPO = "strategiert/netco-bodycam-website";
const GITHUB_BRANCH = "main";
const GITHUB_API_BASE = "https://api.github.com";

// ── GitHub Helpers ────────────────────────────────────────────────────────────

function githubHeaders(pat: string) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "SEO-Ops-Magic/1.0",
  };
}

async function githubGet(path: string, pat: string) {
  const res = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: githubHeaders(pat),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub GET ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function githubPut(path: string, body: unknown, pat: string) {
  const res = await fetch(`${GITHUB_API_BASE}${path}`, {
    method: "PUT",
    headers: githubHeaders(pat),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub PUT ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── pageKey → Dateipfad im Repo ───────────────────────────────────────────────

function pageFilePath(pageKey: string, lang: string): string {
  // Keystatic speichert i18n-Singletons in: src/content/pages/{pageKey}.{lang}.json
  // oder src/content/pages/{lang}/{pageKey}.json — je nach Keystatic-Konfiguration.
  // In der bodycam Website ist das Format: src/content/pages/{pageKey}.json (ein File mit allen Sprachen)
  // Tatsächlich: Keystatic mit i18nSingleton() → src/content/pages/{pageKey}/{lang}.json
  return `src/content/pages/${pageKey}/${lang}.json`;
}

// ── Import: Seiten aus GitHub lesen ──────────────────────────────────────────

/**
 * Einmaliger Import: Liest alle JSON-Dateien aus dem bodycam Repo
 * und speichert sie in bodycamPages.
 * Führt KEINE Überschreibung von dirty-Seiten durch.
 */
export const importPagesFromGitHub = action({
  args: {
    pageKeys: v.array(v.string()),
    langs: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { pageKeys, langs }) => {
    const pat = process.env.GITHUB_PAT;
    if (!pat) throw new Error("GITHUB_PAT ist nicht gesetzt (Convex Environment Variables).");

    const LANGS = langs ?? ["de", "en", "nl", "fr", "es", "it"];
    const results: { pageKey: string; lang: string; status: string }[] = [];

    for (const pageKey of pageKeys) {
      for (const lang of LANGS) {
        const filePath = pageFilePath(pageKey, lang);
        try {
          const data = await githubGet(
            `/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
            pat
          );
          // GitHub gibt content als Base64 zurück
          const content = atob(data.content.replace(/\n/g, ""));

          await ctx.runMutation(api.tables.bodycam.upsertImportedPage, {
            pageKey,
            lang,
            contentJson: content,
          });

          results.push({ pageKey, lang, status: "imported" });
        } catch (err: any) {
          // 404 = Sprache existiert nicht für diese Seite → skip
          if (err.message?.includes("404")) {
            results.push({ pageKey, lang, status: "not_found" });
          } else {
            results.push({ pageKey, lang, status: `error: ${err.message}` });
          }
        }
      }
    }

    return results;
  },
});

// ── Publish: Einzelne Seite committen ────────────────────────────────────────

/**
 * Committed eine geänderte Seite via GitHub API.
 * Löst GitHub Actions → Cloudflare Pages Rebuild aus (~2-3 Min bis live).
 */
export const publishPage = action({
  args: {
    pageKey: v.string(),
    lang: v.string(),
  },
  handler: async (ctx, { pageKey, lang }) => {
    const pat = process.env.GITHUB_PAT;
    if (!pat) throw new Error("GITHUB_PAT ist nicht gesetzt.");

    // Seiteninhalte aus Convex laden
    const page = await ctx.runQuery(api.tables.bodycam.getPage, { pageKey, lang });
    if (!page) throw new Error(`Seite nicht gefunden: ${pageKey}/${lang}`);
    if (!page.isDirty) return { skipped: true, reason: "Keine Änderungen vorhanden." };

    const filePath = pageFilePath(pageKey, lang);

    // Aktuellen SHA aus GitHub holen (nötig für Update)
    let currentSha: string | undefined;
    try {
      const existing = await githubGet(
        `/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
        pat
      );
      currentSha = existing.sha;
    } catch (err: any) {
      if (!err.message?.includes("404")) throw err;
      // 404 = neue Datei, kein SHA nötig
    }

    // JSON formatieren
    const jsonContent = JSON.stringify(JSON.parse(page.contentJson), null, 2);
    const contentBase64 = btoa(unescape(encodeURIComponent(jsonContent)));

    // GitHub PUT (Create oder Update)
    const putBody: Record<string, unknown> = {
      message: `cms: ${pageKey}/${lang} aktualisiert`,
      content: contentBase64,
      branch: GITHUB_BRANCH,
    };
    if (currentSha) putBody.sha = currentSha;

    const result = await githubPut(
      `/repos/${GITHUB_REPO}/contents/${filePath}`,
      putBody,
      pat
    );

    const commitSha = result.commit?.sha ?? "unknown";

    // isDirty = false setzen
    await ctx.runMutation(api.tables.bodycam.markPagePublished, {
      pageKey,
      lang,
      commitSha,
    });

    return { success: true, commitSha, filePath };
  },
});

/**
 * Alle dirty Seiten auf einmal publizieren.
 * Gibt eine Liste aller Publish-Ergebnisse zurück.
 */
export const publishAllDirtyPages = action({
  args: {},
  handler: async (ctx) => {
    const dirtyPages = await ctx.runQuery(api.tables.bodycam.listDirtyPages, {});
    if (dirtyPages.length === 0) return { published: 0, results: [] };

    const results = [];
    for (const page of dirtyPages) {
      try {
        const result = await ctx.runAction(api.actions.bodycam.publishPage, {
          pageKey: page.pageKey,
          lang: page.lang,
        });
        results.push({ pageKey: page.pageKey, lang: page.lang, ...result });
      } catch (err: any) {
        results.push({
          pageKey: page.pageKey,
          lang: page.lang,
          error: err.message,
        });
      }
    }

    const published = results.filter((r) => r.success).length;
    return { published, results };
  },
});

// ── Media: Bild zu R2 hochladen ───────────────────────────────────────────────

/**
 * Lädt ein Bild in den Cloudflare R2 Bucket hoch.
 * Benötigt R2 S3-kompatible Zugangsdaten (R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY).
 */
export const uploadMedia = action({
  args: {
    filename: v.string(),
    contentBase64: v.string(),
    mimeType: v.string(),
    alt: v.optional(v.string()),
  },
  handler: async (ctx, { filename, contentBase64, mimeType, alt }) => {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const accountId = process.env.R2_ACCOUNT_ID ?? "928ca76275d7690620ed2ef13206c991";
    const bucketName = process.env.R2_BUCKET_NAME ?? "netco-bodycam-media";
    const mediaBaseUrl =
      process.env.MEDIA_BASE_URL ??
      `https://${bucketName}.${accountId}.r2.cloudflarestorage.com`;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "R2_ACCESS_KEY_ID und R2_SECRET_ACCESS_KEY müssen in Convex Environment Variables gesetzt sein."
      );
    }

    // Eindeutiger R2-Key: YYYY/MM/filename
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const safeFilename = filename.replace(/[^a-zA-Z0-9._\-]/g, "_");
    const r2Key = `${year}/${month}/${safeFilename}`;

    const body = Uint8Array.from(atob(contentBase64), (c) => c.charCodeAt(0));

    // AWS Signature v4 für R2
    async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string) {
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      return new Uint8Array(
        await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message))
      );
    }

    async function hashSha256(data: Uint8Array): Promise<string> {
      const hash = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    const payloadHash = await hashSha256(body);
    const amzDate =
      now
        .toISOString()
        .replace(/[:\-]|\.\d{3}/g, "")
        .slice(0, 15) + "Z";
    const dateStamp = amzDate.slice(0, 8);
    const region = "auto";
    const service = "s3";
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const endpoint = `https://${host}/${bucketName}/${r2Key}`;

    // Canonical Request
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
    const canonicalHeaders = [
      `content-type:${mimeType}`,
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
    ].join("\n");

    const canonicalRequest = [
      "PUT",
      `/${bucketName}/${r2Key}`,
      "",
      canonicalHeaders + "\n",
      signedHeaders,
      payloadHash,
    ].join("\n");

    // String to Sign
    const credScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const canonHash = await hashSha256(new TextEncoder().encode(canonicalRequest));
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credScope, canonHash].join("\n");

    // Signing Key
    const kDate = await hmacSha256(
      new TextEncoder().encode(`AWS4${secretAccessKey}`),
      dateStamp
    );
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, "aws4_request");
    const signatureBytes = await hmacSha256(kSigning, stringToSign);
    const signature = Array.from(signatureBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        Authorization: authHeader,
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`R2 Upload fehlgeschlagen ${response.status}: ${text}`);
    }

    const url = `${mediaBaseUrl}/${r2Key}`;
    const sizeBytes = body.length;

    // In Convex speichern
    const id = await ctx.runMutation(api.tables.bodycam.saveMedia, {
      filename: safeFilename,
      r2Key,
      url,
      mimeType,
      sizeBytes,
      alt,
    });

    return { id, r2Key, url, sizeBytes };
  },
});
