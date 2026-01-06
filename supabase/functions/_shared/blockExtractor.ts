/**
 * Block Extractor
 * Parses HTML/Markdown content into structured blocks
 */

import { parseHTML } from "https://esm.sh/linkedom@0.18.5";
import type { Block, HeadingBlock, ParagraphBlock, ListBlock, TableBlock, QuoteBlock, ImageBlock, CodeBlock, HrBlock } from "./types.ts";
import { stripDangerous, escapeHtml } from "./sanitize.ts";



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
 * Improved for robustness and table support
 */
function markdownToHtml(md: string): string {
  let html = md.trim();

  // Code blocks first (preserve content)
  html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code class="language-$1">$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers (multi-line to handle trailing spaces)
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

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

  // Tables (Basic support)
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inTable = false;
  let tableHeaderFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isTableRow = line.startsWith('|') && line.endsWith('|');
    const isTableDivider = isTableRow && line.includes('---');

    if (isTableRow) {
      if (!inTable) {
        processedLines.push('<table>');
        inTable = true;
        tableHeaderFound = false;
      }

      if (isTableDivider) {
        tableHeaderFound = true;
        continue;
      }

      const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      const cellTag = tableHeaderFound ? 'td' : 'th';
      const rowContent = cells.map(c => `<${cellTag}>${c.trim()}</${cellTag}>`).join('');
      processedLines.push(`<tr>${rowContent}</tr>`);
    } else {
      if (inTable) {
        processedLines.push('</table>');
        inTable = false;
      }
      processedLines.push(lines[i]);
    }
  }
  if (inTable) processedLines.push('</table>');
  html = processedLines.join('\n');

  // Lists (Unordered)
  const ulLines = html.split('\n');
  const ulProcessed: string[] = [];
  let inUl = false;

  for (const line of ulLines) {
    const isUlItem = /^[-*+]\s+(.+)$/.test(line.trim());
    if (isUlItem) {
      if (!inUl) {
        ulProcessed.push('<ul>');
        inUl = true;
      }
      ulProcessed.push(line.trim().replace(/^[-*+]\s+(.+)$/, '<li>$1</li>'));
    } else {
      if (inUl) {
        ulProcessed.push('</ul>');
        inUl = false;
      }
      ulProcessed.push(line);
    }
  }
  if (inUl) ulProcessed.push('</ul>');
  html = ulProcessed.join('\n');

  // Lists (Ordered)
  const olLines = html.split('\n');
  const olProcessed: string[] = [];
  let inOl = false;

  for (const line of olLines) {
    const isOlItem = /^\d+\.\s+(.+)$/.test(line.trim());
    if (isOlItem) {
      if (!inOl) {
        olProcessed.push('<ol>');
        inOl = true;
      }
      olProcessed.push(line.trim().replace(/^\d+\.\s+(.+)$/, '<li>$1</li>'));
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

  // Paragraphs (lines not wrapped in tags, and not empty)
  html = html.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return line;
    return `<p>${line}</p>`;
  }).join('\n');

  // Clean up empty lines/paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

/**
 * Extract structured blocks from HTML content
 */
export function extractBlocksFromHtml(inputHtml: string): Block[] {
  const sanitized = stripDangerous(inputHtml);
  try {
    const parsed = parseHTML(`<body>${sanitized}</body>`);
    // deno-lint-ignore no-explicit-any
    const doc = (parsed as any).document;
    const body = doc?.querySelector("body");

    if (!body) return [];

    const blocks: Block[] = [];
    let idx = 0;

    function walk(node: any) {
      // TEXT_NODE (3)
      if (node.nodeType === 3) {
        const text = (node.textContent || "").trim();
        if (text) {
          blocks.push({
            id: `paragraph-${idx++}`,
            type: "paragraph",
            text,
            html: `<p>${escapeHtml(text)}</p>`,
          } as ParagraphBlock);
        }
        return;
      }

      // ELEMENT_NODE (1)
      if (node.nodeType !== 1) return;

      const el = node;
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
            html: el.outerHTML || "",
          } as HeadingBlock);
        }
        return;
      }

      // Paragraphs
      if (tag === "p") {
        const text = (el.textContent || "").trim();
        if (text) {
          blocks.push({
            id: `paragraph-${idx++}`,
            type: "paragraph",
            text,
            html: el.outerHTML || "",
          } as ParagraphBlock);
        }
        return;
      }

      // Lists
      if (tag === "ul" || tag === "ol") {
        const listItems = el.querySelectorAll ? el.querySelectorAll("li") : [];
        const items = Array.from(listItems)
          // deno-lint-ignore no-explicit-any
          .map((li: any) => ((li as { textContent?: string }).textContent || "").trim())
          .filter(Boolean);

        if (items.length > 0) {
          blocks.push({
            id: `list-${idx++}`,
            type: "list",
            ordered: tag === "ol",
            items,
            html: el.outerHTML || "",
          } as ListBlock);
        }
        return;
      }

      // Blockquotes
      if (tag === "blockquote") {
        const text = (el.textContent || "").trim();
        if (text) {
          blocks.push({
            id: `quote-${idx++}`,
            type: "quote",
            text,
            html: el.outerHTML || "",
          } as QuoteBlock);
        }
        return;
      }

      // Tables
      if (tag === "table") {
        const headerCells = el.querySelectorAll ? el.querySelectorAll("thead th, tr:first-child th, tr:first-child td") : [];
        // deno-lint-ignore no-explicit-any
        const headers = Array.from(headerCells).map((th: any) => ((th as { textContent?: string }).textContent || "").trim());

        const bodyRows = el.querySelectorAll ? el.querySelectorAll("tbody tr, tr:not(:first-child)") : [];
        // deno-lint-ignore no-explicit-any
        const rows = Array.from(bodyRows).map((tr: any) => {
          const trEl = tr as { querySelectorAll?: (s: string) => unknown[] };
          const cells = trEl.querySelectorAll ? trEl.querySelectorAll("td") : [];
          // deno-lint-ignore no-explicit-any
          return Array.from(cells).map((td: any) => ((td as { textContent?: string }).textContent || "").trim());
        }).filter((row: any[]) => row.length > 0);

        blocks.push({
          id: `table-${idx++}`,
          type: "table",
          headers,
          rows,
          html: el.outerHTML || "",
        } as TableBlock);
        return;
      }

      // Images
      if (tag === "img") {
        const src = el.getAttribute ? el.getAttribute("src") || "" : "";
        const alt = el.getAttribute ? el.getAttribute("alt") || "" : "";
        blocks.push({
          id: `image-${idx++}`,
          type: "image",
          meta: { src, alt },
          html: el.outerHTML || "",
        } as ImageBlock);
        return;
      }

      // Code blocks
      if (tag === "pre") {
        // deno-lint-ignore no-explicit-any
        const codeEl = el.querySelector ? el.querySelector("code") as any : null;
        const code = (codeEl?.textContent || el.textContent || "").trim();
        const langClass = codeEl?.getAttribute ? codeEl.getAttribute("class") || "" : "";
        const langMatch = langClass.match(/language-(\w+)/);

        blocks.push({
          id: `code-${idx++}`,
          type: "code",
          code,
          language: langMatch?.[1],
          html: el.outerHTML || "",
        } as CodeBlock);
        return;
      }

      // Horizontal rules
      if (tag === "hr") {
        blocks.push({
          id: `hr-${idx++}`,
          type: "hr",
          html: el.outerHTML || "",
        } as HrBlock);
        return;
      }

      // Containers (div, section, article) - RECURSE
      if (tag === "div" || tag === "section" || tag === "article") {
        const childNodes = Array.from(el.childNodes);
        for (const child of childNodes) {
          walk(child);
        }
        return;
      }
    }

    // Iterate over root nodes
    const rootNodes = Array.from(body.childNodes);
    for (const node of rootNodes) {
      walk(node);
    }

    return blocks;
  } catch (err) {
    console.error("Error extracting blocks:", err);
    return [];
  }
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
