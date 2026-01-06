/**
 * Block Extractor
 * Parses HTML/Markdown content into structured blocks
 */

import { parseHTML } from "https://esm.sh/linkedom@0.18.5";
import type { Block, HeadingBlock, ParagraphBlock, ListBlock, TableBlock, QuoteBlock, ImageBlock, CodeBlock, HrBlock } from "./types.ts";
import { stripDangerous } from "./sanitize.ts";

/**
 * Check if content is Markdown (simple heuristic)
 */
function isMarkdown(content: string): boolean {
  const mdPatterns = [
    /^#{1,6}\s/m,           // Headers
    /\*\*[^*]+\*\*/,        // Bold
    /\[[^\]]+\]\([^)]+\)/,  // Links
    /^[-*+]\s/m,            // Unordered lists
    /^\d+\.\s/m,            // Ordered lists
    /^>\s/m,                // Blockquotes
    /```[\s\S]*?```/,       // Code blocks
  ];
  return mdPatterns.some(p => p.test(content));
}

/**
 * Convert basic Markdown to HTML
 */
function markdownToHtml(md: string): string {
  let html = md;

  // Code blocks first (preserve content)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Blockquotes
  html = html.replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr>');
  html = html.replace(/^\*\*\*+$/gm, '<hr>');

  // Unordered lists
  const ulRegex = /^[-*+]\s+(.+)$/gm;
  let match;
  let inList = false;
  const lines = html.split('\n');
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isListItem = /^[-*+]\s+(.+)$/.test(line);

    if (isListItem) {
      if (!inList) {
        processedLines.push('<ul>');
        inList = true;
      }
      processedLines.push(line.replace(/^[-*+]\s+(.+)$/, '<li>$1</li>'));
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(line);
    }
  }
  if (inList) processedLines.push('</ul>');
  html = processedLines.join('\n');

  // Ordered lists
  const olLines = html.split('\n');
  const olProcessed: string[] = [];
  let inOl = false;

  for (const line of olLines) {
    const isOlItem = /^\d+\.\s+(.+)$/.test(line);

    if (isOlItem) {
      if (!inOl) {
        olProcessed.push('<ol>');
        inOl = true;
      }
      olProcessed.push(line.replace(/^\d+\.\s+(.+)$/, '<li>$1</li>'));
    } else {
      if (inOl) {
        olProcessed.push('</ol>');
        inOl = false;
      }
      olProcessed.push(line);
    }
  }
  if (inOl) olProcessed.push('</ol>');
  html = olProcessed.join('\n');

  // Paragraphs (lines not wrapped in tags)
  html = html.replace(/^(?!<[a-z])(.*[^\s].*)$/gm, '<p>$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

/**
 * Extract structured blocks from HTML content
 */
export function extractBlocksFromHtml(inputHtml: string): Block[] {
  const sanitized = stripDangerous(inputHtml);
  const { document } = parseHTML(`<body>${sanitized}</body>`);
  const body = document.querySelector("body");

  if (!body) return [];

  const blocks: Block[] = [];
  let idx = 0;

  const children = Array.from(body.children);

  for (const el of children) {
    const tag = (el.tagName || "").toLowerCase();

    // Headings
    if (/^h[1-4]$/.test(tag)) {
      const level = Number(tag[1]) as 1 | 2 | 3 | 4;
      const text = (el.textContent || "").trim();
      if (text) {
        blocks.push({
          id: `heading-${idx++}`,
          type: "heading",
          level,
          text,
          html: el.outerHTML,
        } as HeadingBlock);
      }
      continue;
    }

    // Paragraphs
    if (tag === "p") {
      const text = (el.textContent || "").trim();
      if (text) {
        blocks.push({
          id: `paragraph-${idx++}`,
          type: "paragraph",
          text,
          html: el.outerHTML,
        } as ParagraphBlock);
      }
      continue;
    }

    // Lists
    if (tag === "ul" || tag === "ol") {
      const items = Array.from(el.querySelectorAll("li"))
        .map(li => (li.textContent || "").trim())
        .filter(Boolean);

      if (items.length > 0) {
        blocks.push({
          id: `list-${idx++}`,
          type: "list",
          ordered: tag === "ol",
          items,
          html: el.outerHTML,
        } as ListBlock);
      }
      continue;
    }

    // Blockquotes
    if (tag === "blockquote") {
      const text = (el.textContent || "").trim();
      if (text) {
        blocks.push({
          id: `quote-${idx++}`,
          type: "quote",
          text,
          html: el.outerHTML,
        } as QuoteBlock);
      }
      continue;
    }

    // Tables
    if (tag === "table") {
      const headerCells = el.querySelectorAll("thead th, tr:first-child th");
      const headers = Array.from(headerCells).map(th => (th.textContent || "").trim());

      const bodyRows = el.querySelectorAll("tbody tr, tr:not(:first-child)");
      const rows = Array.from(bodyRows).map(tr =>
        Array.from(tr.querySelectorAll("td")).map(td => (td.textContent || "").trim())
      ).filter(row => row.length > 0);

      blocks.push({
        id: `table-${idx++}`,
        type: "table",
        headers,
        rows,
        html: el.outerHTML,
      } as TableBlock);
      continue;
    }

    // Images
    if (tag === "img") {
      const src = el.getAttribute("src") || "";
      const alt = el.getAttribute("alt") || "";
      blocks.push({
        id: `image-${idx++}`,
        type: "image",
        meta: { src, alt },
        html: el.outerHTML,
      } as ImageBlock);
      continue;
    }

    // Code blocks
    if (tag === "pre") {
      const codeEl = el.querySelector("code");
      const code = (codeEl?.textContent || el.textContent || "").trim();
      const langClass = codeEl?.getAttribute("class") || "";
      const langMatch = langClass.match(/language-(\w+)/);

      blocks.push({
        id: `code-${idx++}`,
        type: "code",
        code,
        language: langMatch?.[1],
        html: el.outerHTML,
      } as CodeBlock);
      continue;
    }

    // Horizontal rules
    if (tag === "hr") {
      blocks.push({
        id: `hr-${idx++}`,
        type: "hr",
        html: el.outerHTML,
      } as HrBlock);
      continue;
    }

    // Divs and other containers - recurse into children
    if (tag === "div" || tag === "section" || tag === "article") {
      const innerBlocks = extractBlocksFromHtml(el.innerHTML || "");
      blocks.push(...innerBlocks);
      continue;
    }

    // Fallback: treat as paragraph if has text content
    const text = (el.textContent || "").trim();
    if (text) {
      blocks.push({
        id: `paragraph-${idx++}`,
        type: "paragraph",
        text,
        html: el.outerHTML,
      } as ParagraphBlock);
    }
  }

  return blocks;
}

/**
 * Main extraction function
 * Handles both HTML and Markdown input
 */
export function extractBlocks(content: string): Block[] {
  if (!content || !content.trim()) {
    return [];
  }

  // Convert Markdown to HTML if needed
  const html = isMarkdown(content) ? markdownToHtml(content) : content;

  return extractBlocksFromHtml(html);
}

/**
 * Create a compressed summary of blocks for LLM context
 * Limits text length to reduce token usage
 */
export function summarizeBlocksForLlm(blocks: Block[], maxTextLength = 240): object[] {
  return blocks.map(block => {
    const summary: Record<string, unknown> = {
      id: block.id,
      type: block.type,
    };

    if (block.type === "heading") {
      summary.level = block.level;
      summary.text = block.text;
    } else if (block.type === "paragraph") {
      summary.preview = block.text.length > maxTextLength
        ? block.text.slice(0, maxTextLength) + "..."
        : block.text;
    } else if (block.type === "list") {
      summary.ordered = block.ordered;
      summary.itemCount = block.items.length;
      summary.items = block.items.slice(0, 12).map(item =>
        item.length > 80 ? item.slice(0, 80) + "..." : item
      );
    } else if (block.type === "table") {
      summary.headers = block.headers;
      summary.rowCount = block.rows.length;
      summary.sampleRows = block.rows.slice(0, 3);
    } else if (block.type === "quote") {
      summary.preview = block.text.length > maxTextLength
        ? block.text.slice(0, maxTextLength) + "..."
        : block.text;
    } else if (block.type === "image") {
      summary.alt = block.meta?.alt;
    }

    return summary;
  });
}
