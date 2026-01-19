"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * HTML Export Action
 *
 * Renders article content to complete HTML document using design recipe.
 * Converted from supabase/functions/generate-html-export/index.ts
 *
 * This is a deterministic render - no LLM calls, uses stored recipe.
 */

interface Recipe {
  recipeVersion: string;
  theme: "editorial-bold" | "minimal-clean" | "tech-neon";
  toc: boolean;
  layout: Array<{
    blockId: string;
    component: string;
    variant: string;
  }>;
}

interface Block {
  id: string;
  type: "heading" | "paragraph" | "list" | "quote" | "code" | "image" | "table" | "hr" | "callout";
  content: string;
  level?: number;
  items?: string[];
  calloutType?: "info" | "warning" | "tip" | "error";
  altText?: string;
  src?: string;
}

interface ArticleMeta {
  title: string;
  metaDescription?: string;
  author?: string;
  authorBio?: string;
  authorImage?: string;
  publishDate?: string;
  readingTime?: string;
  primaryKeyword?: string;
  ogTags?: {
    ogTitle: string;
    ogDescription: string;
    twitterCard: string;
  };
  schemaMarkup?: {
    article?: object;
    faq?: object;
  };
}

/**
 * Generate HTML export for an article
 */
export const generate = action({
  args: {
    articleId: v.id("articles"),
    format: v.optional(v.string()), // 'full' | 'body-only'
  },
  handler: async (ctx, { articleId, format = "full" }): Promise<{
    success: boolean;
    exportId?: string;
    htmlLength?: number;
    blocksRendered?: number;
    recipeSource?: string;
    theme?: string;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Unauthorized" };
    }

    // Get article
    const article = await ctx.runQuery(api.tables.articles.get, { id: articleId });
    if (!article) {
      return { success: false, error: "Article not found" };
    }

    // Get design recipe
    const recipes = await ctx.runQuery(api.tables.articleDesignRecipes.getByArticle, {
      articleId,
    });

    let recipe: Recipe;
    let recipeSource = "database";

    if (recipes.length > 0 && recipes[0].recipeJson) {
      recipe = recipes[0].recipeJson as Recipe;
    } else {
      // Fallback recipe
      recipe = generateFallbackRecipe();
      recipeSource = "fallback";
    }

    try {
      // Extract blocks from content
      const content = article.contentMarkdown || article.contentHtml || "";
      const blocks = extractBlocks(content);

      // Render blocks to HTML
      const bodyHtml = renderBlocks(blocks, recipe);

      // Extract SEO metadata from article outline if available
      const outlineData = article.outlineJson as any;
      const seoMetadata = outlineData?.seoMetadata;

      // Build article meta for HTML generation
      const articleMeta: ArticleMeta = {
        title: article.title,
        metaDescription: article.metaDescription,
        publishDate: new Date().toISOString().split("T")[0],
        readingTime: seoMetadata?.readingTime,
        primaryKeyword: article.primaryKeyword,
        ogTags: seoMetadata?.ogTags,
        schemaMarkup: seoMetadata?.schemaMarkup,
      };

      // Generate full HTML document or body only
      let htmlContent: string;
      if (format === "body-only") {
        htmlContent = bodyHtml;
      } else {
        htmlContent = generateHtmlDocument({
          title: article.title,
          metaDescription: article.metaDescription,
          theme: recipe.theme,
          bodyHtml,
          meta: articleMeta,
        });
      }

      // Save HTML export
      const existingExports = await ctx.runQuery(api.tables.htmlExports.getByArticle, {
        articleId,
      });

      let exportId: string;
      if (existingExports.length > 0) {
        await ctx.runMutation(api.tables.htmlExports.update, {
          id: existingExports[0]._id,
          htmlContent,
          recipeVersion: recipe.recipeVersion,
        });
        exportId = existingExports[0]._id;
      } else {
        exportId = await ctx.runMutation(api.tables.htmlExports.create, {
          projectId: article.projectId,
          articleId,
          name: `${article.title} - HTML Export`,
          htmlContent,
          designVariant: recipe.theme,
          recipeVersion: recipe.recipeVersion,
        });
      }

      return {
        success: true,
        exportId,
        htmlLength: htmlContent.length,
        blocksRendered: blocks.length,
        recipeSource,
        theme: recipe.theme,
      };
    } catch (error) {
      console.error("Error generating HTML export:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Export failed",
      };
    }
  },
});

/**
 * Generate fallback recipe when none exists
 */
function generateFallbackRecipe(): Recipe {
  return {
    recipeVersion: "v1",
    theme: "editorial-bold",
    toc: true,
    layout: [
      { blockId: "intro", component: "hero", variant: "centered" },
      { blockId: "content", component: "text", variant: "default" },
      { blockId: "faq", component: "faq", variant: "accordion" },
      { blockId: "cta", component: "cta", variant: "primary" },
    ],
  };
}

/**
 * Extract content blocks from markdown
 */
function extractBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");
  let currentBlock: Block | null = null;
  let blockId = 0;
  let inCallout = false;
  let calloutType: "info" | "warning" | "tip" | "error" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = {
        id: `block-${blockId++}`,
        type: "heading",
        content: headingMatch[2],
        level: headingMatch[1].length,
      };
      blocks.push(currentBlock);
      currentBlock = null;
      continue;
    }

    // Horizontal rule
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      if (currentBlock) blocks.push(currentBlock);
      blocks.push({ id: `block-${blockId++}`, type: "hr", content: "" });
      currentBlock = null;
      continue;
    }

    // Callout detection (e.g. > **Info:** or > ℹ️ or > **Key Takeaways:**)
    if (trimmed.startsWith(">")) {
      const calloutContent = trimmed.replace(/^>\s*/, "");

      // Check for callout markers
      if (calloutContent.match(/^\*\*(?:Info|Hinweis|ℹ️):/i) || calloutContent.startsWith("ℹ️")) {
        if (currentBlock) blocks.push(currentBlock);
        inCallout = true;
        calloutType = "info";
        currentBlock = {
          id: `block-${blockId++}`,
          type: "callout",
          content: calloutContent.replace(/^\*\*(?:Info|Hinweis|ℹ️):\*\*\s*/i, "").replace(/^ℹ️\s*/, ""),
          calloutType: "info"
        };
        continue;
      }
      if (calloutContent.match(/^\*\*(?:Warning|Warnung|Achtung|⚠️):/i) || calloutContent.startsWith("⚠️")) {
        if (currentBlock) blocks.push(currentBlock);
        inCallout = true;
        calloutType = "warning";
        currentBlock = {
          id: `block-${blockId++}`,
          type: "callout",
          content: calloutContent.replace(/^\*\*(?:Warning|Warnung|Achtung|⚠️):\*\*\s*/i, "").replace(/^⚠️\s*/, ""),
          calloutType: "warning"
        };
        continue;
      }
      if (calloutContent.match(/^\*\*(?:Tip|Tipp|Pro Tip|💡):/i) || calloutContent.startsWith("💡")) {
        if (currentBlock) blocks.push(currentBlock);
        inCallout = true;
        calloutType = "tip";
        currentBlock = {
          id: `block-${blockId++}`,
          type: "callout",
          content: calloutContent.replace(/^\*\*(?:Tip|Tipp|Pro Tip|💡):\*\*\s*/i, "").replace(/^💡\s*/, ""),
          calloutType: "tip"
        };
        continue;
      }
      if (calloutContent.match(/^\*\*(?:Key Takeaways|Wichtig|Zusammenfassung):/i)) {
        if (currentBlock) blocks.push(currentBlock);
        inCallout = true;
        calloutType = "info";
        currentBlock = {
          id: `block-${blockId++}`,
          type: "callout",
          content: calloutContent,
          calloutType: "info"
        };
        continue;
      }

      // Continue callout
      if (inCallout && currentBlock?.type === "callout") {
        currentBlock.content += "\n" + calloutContent;
        continue;
      }

      // Regular blockquote
      if (currentBlock && currentBlock.type !== "quote") {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { id: `block-${blockId++}`, type: "quote", content: "" };
      }
      currentBlock.content += calloutContent + "\n";
      continue;
    } else {
      // End callout when line doesn't start with >
      if (inCallout) {
        inCallout = false;
        calloutType = null;
      }
    }

    // Image (markdown format)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      if (currentBlock) blocks.push(currentBlock);
      blocks.push({
        id: `block-${blockId++}`,
        type: "image",
        content: "",
        altText: imageMatch[1],
        src: imageMatch[2],
      });
      currentBlock = null;
      continue;
    }

    // List item
    if (trimmed.match(/^[-*+]\s/) || trimmed.match(/^\d+\.\s/)) {
      if (currentBlock && currentBlock.type !== "list") {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { id: `block-${blockId++}`, type: "list", content: "", items: [] };
      }
      currentBlock.items?.push(trimmed.replace(/^[-*+]\s|^\d+\.\s/, ""));
      continue;
    }

    // Code block
    if (trimmed.startsWith("```")) {
      if (currentBlock && currentBlock.type === "code") {
        blocks.push(currentBlock);
        currentBlock = null;
      } else {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { id: `block-${blockId++}`, type: "code", content: "" };
      }
      continue;
    }

    if (currentBlock?.type === "code") {
      currentBlock.content += line + "\n";
      continue;
    }

    // Empty line - end current block
    if (trimmed === "") {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      continue;
    }

    // Regular paragraph
    if (!currentBlock || currentBlock.type !== "paragraph") {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { id: `block-${blockId++}`, type: "paragraph", content: "" };
    }
    currentBlock.content += (currentBlock.content ? " " : "") + trimmed;
  }

  if (currentBlock) blocks.push(currentBlock);

  return blocks;
}

/**
 * Render blocks to HTML using recipe
 */
function renderBlocks(blocks: Block[], recipe: Recipe): string {
  const themeClasses = getThemeClasses(recipe.theme);

  let html = `<div id="seo-ops-content-wrapper" class="seo-ops-content ${themeClasses.wrapper}">\n`;

  // Add TOC if enabled
  if (recipe.toc) {
    const headings = blocks.filter((b) => b.type === "heading" && (b.level ?? 1) <= 3);
    if (headings.length > 2) {
      html += renderToc(headings, themeClasses);
    }
  }

  // Render each block
  for (const block of blocks) {
    html += renderBlock(block, themeClasses);
  }

  html += "</div>";

  return html;
}

/**
 * Get theme-specific CSS classes
 */
function getThemeClasses(theme: string): Record<string, string> {
  const themes: Record<string, Record<string, string>> = {
    "editorial-bold": {
      wrapper: "theme-editorial-bold",
      article: "max-w-4xl mx-auto px-4 py-8",
      heading: "text-3xl font-bold mb-4",
      heading2: "text-2xl md:text-3xl font-semibold text-gray-900 mt-12 mb-4",
      heading3: "text-xl md:text-2xl font-medium text-gray-800 mt-8 mb-3",
      paragraph: "text-base md:text-lg text-gray-700 leading-relaxed mb-4",
      lead: "text-xl text-gray-600 leading-relaxed mb-8",
      list: "list-disc list-inside space-y-2 text-gray-700 mb-6",
      quote: "border-l-4 border-blue-500 pl-4 italic text-gray-600 my-6",
      code: "bg-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto my-6",
      hr: "border-t-2 border-gray-300 my-8",
      toc: "bg-gray-50 rounded-lg p-6 mb-8",
      image: "w-full rounded-lg shadow-md",
      figcaption: "text-sm text-gray-500 mt-2 text-center",
      calloutInfo: "bg-blue-50 border-l-4 border-blue-500 p-4 my-6",
      calloutWarning: "bg-yellow-50 border-l-4 border-yellow-500 p-4 my-6",
      calloutTip: "bg-green-50 border-l-4 border-green-500 p-4 my-6",
      calloutError: "bg-red-50 border-l-4 border-red-500 p-4 my-6",
      authorBox: "border-t pt-8 mt-12",
    },
    "minimal-clean": {
      wrapper: "theme-minimal-clean",
      article: "max-w-3xl mx-auto px-4 py-6",
      heading: "text-2xl font-semibold mb-3",
      heading2: "text-xl font-medium text-gray-800 mt-10 mb-3",
      heading3: "text-lg font-medium text-gray-700 mt-6 mb-2",
      paragraph: "text-base leading-relaxed mb-3 text-gray-600",
      lead: "text-lg text-gray-500 leading-relaxed mb-6",
      list: "list-disc pl-5 space-y-1 mb-3",
      quote: "border-l-2 border-gray-400 pl-3 italic my-3 text-gray-500",
      code: "bg-gray-50 p-3 rounded font-mono text-sm",
      hr: "border-t border-gray-200 my-6",
      toc: "border border-gray-200 p-4 rounded mb-6",
      image: "w-full rounded shadow-sm",
      figcaption: "text-xs text-gray-400 mt-1 text-center",
      calloutInfo: "bg-gray-50 border-l-2 border-gray-400 p-3 my-4",
      calloutWarning: "bg-yellow-50 border-l-2 border-yellow-400 p-3 my-4",
      calloutTip: "bg-green-50 border-l-2 border-green-400 p-3 my-4",
      calloutError: "bg-red-50 border-l-2 border-red-400 p-3 my-4",
      authorBox: "border-t pt-6 mt-10",
    },
    "tech-neon": {
      wrapper: "theme-tech-neon bg-gray-900 text-white",
      article: "max-w-4xl mx-auto px-4 py-8",
      heading: "text-3xl font-bold mb-4 text-cyan-400",
      heading2: "text-2xl font-bold text-cyan-300 mt-12 mb-4",
      heading3: "text-xl font-semibold text-cyan-200 mt-8 mb-3",
      paragraph: "text-lg leading-relaxed mb-4 text-gray-300",
      lead: "text-xl text-gray-400 leading-relaxed mb-8",
      list: "list-disc pl-6 mb-4 space-y-2 text-gray-300",
      quote: "border-l-4 border-cyan-500 pl-4 italic my-4 text-gray-400",
      code: "bg-gray-800 p-4 rounded-lg font-mono text-sm text-green-400 overflow-x-auto",
      hr: "border-t-2 border-cyan-800 my-8",
      toc: "bg-gray-800 p-6 rounded-lg mb-8 border border-cyan-800",
      image: "w-full rounded-lg",
      figcaption: "text-sm text-gray-500 mt-2 text-center",
      calloutInfo: "bg-gray-800 border-l-4 border-cyan-500 p-4 my-6",
      calloutWarning: "bg-gray-800 border-l-4 border-yellow-500 p-4 my-6",
      calloutTip: "bg-gray-800 border-l-4 border-green-500 p-4 my-6",
      calloutError: "bg-gray-800 border-l-4 border-red-500 p-4 my-6",
      authorBox: "border-t border-gray-700 pt-8 mt-12",
    },
  };

  return themes[theme] || themes["editorial-bold"];
}

/**
 * Render table of contents
 */
function renderToc(headings: Block[], classes: Record<string, string>): string {
  let html = `<nav class="${classes.toc}">\n`;
  html += '<h2 class="text-xl font-bold mb-3">Inhaltsverzeichnis</h2>\n';
  html += "<ul>\n";

  for (const heading of headings) {
    const indent = ((heading.level ?? 1) - 1) * 16;
    const slug = heading.content.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    html += `<li style="margin-left: ${indent}px"><a href="#${slug}" class="text-blue-600 hover:underline">${heading.content}</a></li>\n`;
  }

  html += "</ul>\n</nav>\n";
  return html;
}

/**
 * Render a single block to HTML
 */
function renderBlock(block: Block, classes: Record<string, string>): string {
  switch (block.type) {
    case "heading": {
      const level = block.level ?? 2;
      const tag = `h${level}`;
      const slug = block.content
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Use specific heading classes if available
      let headingClass = classes.heading;
      if (level === 2 && classes.heading2) headingClass = classes.heading2;
      if (level === 3 && classes.heading3) headingClass = classes.heading3;

      return `<${tag} id="${slug}" class="${headingClass}">${escapeHtml(block.content)}</${tag}>\n`;
    }

    case "paragraph":
      return `<p class="${classes.paragraph}">${formatInlineMarkdown(block.content)}</p>\n`;

    case "list":
      return `<ul class="${classes.list}">\n${
        block.items?.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join("\n") ?? ""
      }\n</ul>\n`;

    case "quote":
      return `<blockquote class="${classes.quote}">${formatInlineMarkdown(block.content.trim())}</blockquote>\n`;

    case "code":
      return `<pre class="${classes.code}"><code>${escapeHtml(block.content.trim())}</code></pre>\n`;

    case "hr":
      return `<hr class="${classes.hr}" />\n`;

    case "image":
      return `<figure class="my-8">
  <img
    src="${escapeHtml(block.src || "")}"
    alt="${escapeHtml(block.altText || "")}"
    class="${classes.image || "w-full rounded-lg"}"
    loading="lazy"
  />
  ${block.altText ? `<figcaption class="${classes.figcaption || "text-sm text-gray-500 mt-2 text-center"}">${escapeHtml(block.altText)}</figcaption>` : ""}
</figure>\n`;

    case "callout": {
      const calloutClass = getCalloutClass(block.calloutType || "info", classes);
      const icon = getCalloutIcon(block.calloutType || "info");
      const textColor = getCalloutTextColor(block.calloutType || "info");

      return `<div class="${calloutClass}" role="note">
  <div class="flex">
    <div class="flex-shrink-0">${icon}</div>
    <div class="ml-3">
      <p class="${textColor}">${formatInlineMarkdown(block.content.trim())}</p>
    </div>
  </div>
</div>\n`;
    }

    default:
      return `<div>${formatInlineMarkdown(block.content)}</div>\n`;
  }
}

/**
 * Get callout class based on type
 */
function getCalloutClass(type: string, classes: Record<string, string>): string {
  switch (type) {
    case "warning":
      return classes.calloutWarning || "bg-yellow-50 border-l-4 border-yellow-500 p-4 my-6";
    case "tip":
      return classes.calloutTip || "bg-green-50 border-l-4 border-green-500 p-4 my-6";
    case "error":
      return classes.calloutError || "bg-red-50 border-l-4 border-red-500 p-4 my-6";
    default:
      return classes.calloutInfo || "bg-blue-50 border-l-4 border-blue-500 p-4 my-6";
  }
}

/**
 * Get callout icon based on type
 */
function getCalloutIcon(type: string): string {
  switch (type) {
    case "warning":
      return "⚠️";
    case "tip":
      return "💡";
    case "error":
      return "❌";
    default:
      return "ℹ️";
  }
}

/**
 * Get callout text color based on type
 */
function getCalloutTextColor(type: string): string {
  switch (type) {
    case "warning":
      return "text-yellow-700";
    case "tip":
      return "text-green-700";
    case "error":
      return "text-red-700";
    default:
      return "text-blue-700";
  }
}

/**
 * Format inline markdown (bold, italic, links)
 */
function formatInlineMarkdown(text: string): string {
  let formatted = escapeHtml(text);

  // Bold **text** or __text__
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic *text* or _text_
  formatted = formatted.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  formatted = formatted.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Links [text](url)
  formatted = formatted.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-blue-600 hover:underline">$1</a>'
  );

  // Inline code `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>');

  return formatted;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generate complete HTML document with semantic structure and schema
 */
function generateHtmlDocument(options: {
  title: string;
  metaDescription?: string;
  theme: string;
  bodyHtml: string;
  meta?: ArticleMeta;
}): string {
  const { title, metaDescription, theme, bodyHtml, meta } = options;

  // Build OG tags
  const ogTitle = meta?.ogTags?.ogTitle || title;
  const ogDescription = meta?.ogTags?.ogDescription || metaDescription || "";
  const twitterCard = meta?.ogTags?.twitterCard || "summary_large_image";

  // Build schema markup script tags
  let schemaScripts = "";
  if (meta?.schemaMarkup?.article) {
    schemaScripts += `<script type="application/ld+json">\n${JSON.stringify(meta.schemaMarkup.article, null, 2)}\n</script>\n`;
  }
  if (meta?.schemaMarkup?.faq) {
    schemaScripts += `<script type="application/ld+json">\n${JSON.stringify(meta.schemaMarkup.faq, null, 2)}\n</script>\n`;
  }

  // Build author box if provided
  const authorBox = meta?.author
    ? `<aside class="author-box flex items-center mt-12 pt-8 border-t border-gray-200">
    ${meta.authorImage ? `<img src="${escapeHtml(meta.authorImage)}" alt="${escapeHtml(meta.author)}" class="w-16 h-16 rounded-full" />` : ""}
    <div class="${meta.authorImage ? "ml-4" : ""}">
      <p class="font-semibold">${escapeHtml(meta.author)}</p>
      ${meta.authorBio ? `<p class="text-gray-500 text-sm">${escapeHtml(meta.authorBio)}</p>` : ""}
    </div>
  </aside>`
    : "";

  // Build article header with date and reading time
  const articleHeader = `<header class="mb-8">
    <h1 class="text-3xl md:text-4xl font-bold mb-4">${escapeHtml(title)}</h1>
    <div class="flex items-center text-gray-500 text-sm">
      ${meta?.publishDate ? `<time datetime="${escapeHtml(meta.publishDate)}">${escapeHtml(meta.publishDate)}</time>` : ""}
      ${meta?.publishDate && meta?.readingTime ? '<span class="mx-2">•</span>' : ""}
      ${meta?.readingTime ? `<span>${escapeHtml(meta.readingTime)} Lesezeit</span>` : ""}
    </div>
  </header>`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${metaDescription ? `<meta name="description" content="${escapeHtml(metaDescription)}">` : ""}

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  ${ogDescription ? `<meta property="og:description" content="${escapeHtml(ogDescription)}">` : ""}

  <!-- Twitter -->
  <meta name="twitter:card" content="${escapeHtml(twitterCard)}">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  ${ogDescription ? `<meta name="twitter:description" content="${escapeHtml(ogDescription)}">` : ""}

  ${schemaScripts}

  <style>
    /* Base styles */
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; }

    .seo-ops-content {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
    }

    /* Skip to content for accessibility */
    .skip-to-content {
      position: absolute;
      left: -9999px;
      top: 0;
      padding: 1rem;
      background: #000;
      color: #fff;
      z-index: 1000;
    }
    .skip-to-content:focus {
      left: 0;
    }

    /* Theme: Editorial Bold */
    .theme-editorial-bold {
      color: #1a1a1a;
      background: #ffffff;
    }
    .theme-editorial-bold h1, .theme-editorial-bold h2, .theme-editorial-bold h3 {
      color: #0a0a0a;
    }

    /* Theme: Minimal Clean */
    .theme-minimal-clean {
      color: #333;
      background: #fafafa;
    }

    /* Theme: Tech Neon */
    .theme-tech-neon {
      color: #e0e0e0;
      background: #0d1117;
    }
    .theme-tech-neon a {
      color: #00d4ff;
    }

    /* Layout */
    .max-w-4xl { max-width: 56rem; }
    .max-w-3xl { max-width: 48rem; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
    .py-8 { padding-top: 2rem; padding-bottom: 2rem; }

    /* Typography */
    .text-4xl { font-size: 2.25rem; }
    .text-3xl { font-size: 1.875rem; }
    .text-2xl { font-size: 1.5rem; }
    .text-xl { font-size: 1.25rem; }
    .text-lg { font-size: 1.125rem; }
    .text-base { font-size: 1rem; }
    .text-sm { font-size: 0.875rem; }
    .text-xs { font-size: 0.75rem; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .font-mono { font-family: ui-monospace, monospace; }
    .italic { font-style: italic; }
    .leading-relaxed { line-height: 1.625; }

    /* Spacing */
    .mt-6 { margin-top: 1.5rem; }
    .mt-8 { margin-top: 2rem; }
    .mt-10 { margin-top: 2.5rem; }
    .mt-12 { margin-top: 3rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mb-8 { margin-bottom: 2rem; }
    .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
    .my-6 { margin-top: 1.5rem; margin-bottom: 1.5rem; }
    .my-8 { margin-top: 2rem; margin-bottom: 2rem; }
    .mx-2 { margin-left: 0.5rem; margin-right: 0.5rem; }
    .ml-3 { margin-left: 0.75rem; }
    .ml-4 { margin-left: 1rem; }
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-6 { padding: 1.5rem; }
    .px-1 { padding-left: 0.25rem; padding-right: 0.25rem; }
    .pl-4 { padding-left: 1rem; }
    .pl-5 { padding-left: 1.25rem; }
    .pl-6 { padding-left: 1.5rem; }
    .pt-6 { padding-top: 1.5rem; }
    .pt-8 { padding-top: 2rem; }

    /* Borders */
    .rounded { border-radius: 0.25rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-full { border-radius: 9999px; }
    .border { border-width: 1px; border-style: solid; }
    .border-t { border-top-width: 1px; border-top-style: solid; }
    .border-l-2 { border-left-width: 2px; border-left-style: solid; }
    .border-l-4 { border-left-width: 4px; border-left-style: solid; }
    .border-gray-200 { border-color: #e5e7eb; }
    .border-gray-700 { border-color: #374151; }
    .border-blue-500 { border-color: #3b82f6; }
    .border-yellow-500 { border-color: #eab308; }
    .border-green-500 { border-color: #22c55e; }
    .border-red-500 { border-color: #ef4444; }
    .border-cyan-500 { border-color: #06b6d4; }
    .border-cyan-800 { border-color: #155e75; }

    /* Colors */
    .bg-gray-50 { background-color: #f9fafb; }
    .bg-gray-100 { background-color: #f3f4f6; }
    .bg-gray-800 { background-color: #1f2937; }
    .bg-gray-900 { background-color: #111827; }
    .bg-blue-50 { background-color: #eff6ff; }
    .bg-yellow-50 { background-color: #fefce8; }
    .bg-green-50 { background-color: #f0fdf4; }
    .bg-red-50 { background-color: #fef2f2; }
    .text-white { color: #ffffff; }
    .text-gray-300 { color: #d1d5db; }
    .text-gray-400 { color: #9ca3af; }
    .text-gray-500 { color: #6b7280; }
    .text-gray-600 { color: #4b5563; }
    .text-gray-700 { color: #374151; }
    .text-gray-800 { color: #1f2937; }
    .text-gray-900 { color: #111827; }
    .text-blue-600 { color: #2563eb; }
    .text-blue-700 { color: #1d4ed8; }
    .text-yellow-700 { color: #a16207; }
    .text-green-700 { color: #15803d; }
    .text-red-700 { color: #b91c1c; }
    .text-cyan-200 { color: #a5f3fc; }
    .text-cyan-300 { color: #67e8f9; }
    .text-cyan-400 { color: #22d3ee; }
    .text-green-400 { color: #4ade80; }

    /* Flexbox */
    .flex { display: flex; }
    .flex-shrink-0 { flex-shrink: 0; }
    .items-center { align-items: center; }
    .space-y-1 > * + * { margin-top: 0.25rem; }
    .space-y-2 > * + * { margin-top: 0.5rem; }

    /* List styles */
    .list-disc { list-style-type: disc; }
    .list-inside { list-style-position: inside; }

    /* Other */
    .overflow-x-auto { overflow-x: auto; }
    .shadow-md { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
    .w-full { width: 100%; }
    .w-16 { width: 4rem; }
    .h-16 { height: 4rem; }

    a.text-blue-600:hover { text-decoration: underline; }

    /* Responsive */
    @media (min-width: 768px) {
      .md\\:text-4xl { font-size: 2.25rem; }
      .md\\:text-3xl { font-size: 1.875rem; }
      .md\\:text-2xl { font-size: 1.5rem; }
      .md\\:text-lg { font-size: 1.125rem; }
    }
  </style>
</head>
<body>
<a href="#main-content" class="skip-to-content">Zum Hauptinhalt springen</a>
<article id="main-content" class="seo-ops-content ${theme === "tech-neon" ? "theme-tech-neon bg-gray-900 text-white" : theme === "minimal-clean" ? "theme-minimal-clean" : "theme-editorial-bold"}">
  <div class="max-w-4xl mx-auto px-4 py-8">
    ${articleHeader}
    <div class="prose prose-lg max-w-none">
${bodyHtml}
    </div>
    ${authorBox}
  </div>
</article>
</body>
</html>`;
}
