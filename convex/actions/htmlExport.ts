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
  type: "heading" | "paragraph" | "list" | "quote" | "code" | "image" | "table" | "hr";
  content: string;
  level?: number;
  items?: string[];
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

    // Blockquote
    if (trimmed.startsWith(">")) {
      if (currentBlock && currentBlock.type !== "quote") {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { id: `block-${blockId++}`, type: "quote", content: "" };
      }
      currentBlock.content += trimmed.replace(/^>\s*/, "") + "\n";
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
      heading: "text-3xl font-bold mb-4",
      paragraph: "text-lg leading-relaxed mb-4",
      list: "list-disc pl-6 mb-4",
      quote: "border-l-4 border-blue-500 pl-4 italic my-4",
      code: "bg-gray-100 p-4 rounded font-mono text-sm overflow-x-auto",
      hr: "border-t-2 border-gray-300 my-8",
      toc: "bg-gray-50 p-6 rounded-lg mb-8",
    },
    "minimal-clean": {
      wrapper: "theme-minimal-clean",
      heading: "text-2xl font-semibold mb-3",
      paragraph: "text-base leading-relaxed mb-3",
      list: "list-disc pl-5 mb-3",
      quote: "border-l-2 border-gray-400 pl-3 italic my-3",
      code: "bg-gray-50 p-3 rounded font-mono text-sm",
      hr: "border-t border-gray-200 my-6",
      toc: "border border-gray-200 p-4 rounded mb-6",
    },
    "tech-neon": {
      wrapper: "theme-tech-neon bg-gray-900 text-white",
      heading: "text-3xl font-bold mb-4 text-cyan-400",
      paragraph: "text-lg leading-relaxed mb-4",
      list: "list-disc pl-6 mb-4",
      quote: "border-l-4 border-cyan-500 pl-4 italic my-4",
      code: "bg-gray-800 p-4 rounded font-mono text-sm text-green-400",
      hr: "border-t-2 border-cyan-800 my-8",
      toc: "bg-gray-800 p-6 rounded-lg mb-8 border border-cyan-800",
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
      const slug = block.content.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return `<${tag} id="${slug}" class="${classes.heading}">${escapeHtml(block.content)}</${tag}>\n`;
    }

    case "paragraph":
      return `<p class="${classes.paragraph}">${escapeHtml(block.content)}</p>\n`;

    case "list":
      return `<ul class="${classes.list}">\n${
        block.items?.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n") ?? ""
      }\n</ul>\n`;

    case "quote":
      return `<blockquote class="${classes.quote}">${escapeHtml(block.content.trim())}</blockquote>\n`;

    case "code":
      return `<pre class="${classes.code}"><code>${escapeHtml(block.content.trim())}</code></pre>\n`;

    case "hr":
      return `<hr class="${classes.hr}" />\n`;

    default:
      return `<div>${escapeHtml(block.content)}</div>\n`;
  }
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
 * Generate complete HTML document
 */
function generateHtmlDocument(options: {
  title: string;
  metaDescription?: string;
  theme: string;
  bodyHtml: string;
}): string {
  const { title, metaDescription, theme, bodyHtml } = options;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${metaDescription ? `<meta name="description" content="${escapeHtml(metaDescription)}">` : ""}
  <style>
    /* Base styles */
    .seo-ops-content {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
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

    /* Utility classes */
    .text-3xl { font-size: 1.875rem; }
    .text-2xl { font-size: 1.5rem; }
    .text-xl { font-size: 1.25rem; }
    .text-lg { font-size: 1.125rem; }
    .text-base { font-size: 1rem; }
    .text-sm { font-size: 0.875rem; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-mono { font-family: ui-monospace, monospace; }
    .italic { font-style: italic; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mb-8 { margin-bottom: 2rem; }
    .my-3 { margin-top: 0.75rem; margin-bottom: 0.75rem; }
    .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
    .my-6 { margin-top: 1.5rem; margin-bottom: 1.5rem; }
    .my-8 { margin-top: 2rem; margin-bottom: 2rem; }
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-6 { padding: 1.5rem; }
    .pl-3 { padding-left: 0.75rem; }
    .pl-4 { padding-left: 1rem; }
    .pl-5 { padding-left: 1.25rem; }
    .pl-6 { padding-left: 1.5rem; }
    .rounded { border-radius: 0.25rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .border { border-width: 1px; }
    .border-t { border-top-width: 1px; }
    .border-t-2 { border-top-width: 2px; }
    .border-l-2 { border-left-width: 2px; }
    .border-l-4 { border-left-width: 4px; }
    .border-gray-200 { border-color: #e5e7eb; }
    .border-gray-300 { border-color: #d1d5db; }
    .border-gray-400 { border-color: #9ca3af; }
    .border-blue-500 { border-color: #3b82f6; }
    .border-cyan-500 { border-color: #06b6d4; }
    .border-cyan-800 { border-color: #155e75; }
    .bg-gray-50 { background-color: #f9fafb; }
    .bg-gray-100 { background-color: #f3f4f6; }
    .bg-gray-800 { background-color: #1f2937; }
    .bg-gray-900 { background-color: #111827; }
    .text-white { color: #ffffff; }
    .text-cyan-400 { color: #22d3ee; }
    .text-green-400 { color: #4ade80; }
    .text-blue-600 { color: #2563eb; }
    .list-disc { list-style-type: disc; }
    .overflow-x-auto { overflow-x: auto; }
    .leading-relaxed { line-height: 1.625; }
    .hover\\:underline:hover { text-decoration: underline; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
