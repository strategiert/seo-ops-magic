/**
 * Deterministic HTML Renderer
 * Renders blocks to HTML using recipe layout decisions
 */

import type { Block, HeadingBlock, ParagraphBlock, ListBlock, TableBlock, QuoteBlock, ImageBlock, CodeBlock } from "./types.ts";
import type { Recipe, LayoutItem, ContrastPairItem, StandardLayoutItem } from "./recipeSchema.ts";
import { isContrastPair, isStandardLayoutItem } from "./recipeSchema.ts";
import { escapeHtml } from "./sanitize.ts";

// ============================================================================
// INLINE STYLES (NetCo Design)
// ============================================================================

const STYLES = {
  h1: "font-family: 'Antonio', sans-serif; font-weight: bold; font-size: 2.8em; margin-top: 0; margin-bottom: 15px; line-height: 1.2; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);",
  h2: "font-family: 'Antonio', sans-serif; font-weight: bold; color: #003366; font-size: 2em; margin-top: 40px; margin-bottom: 20px; border-bottom: 2px solid #ff6600; padding-bottom: 10px;",
  h3: "font-family: 'Antonio', sans-serif; font-weight: bold; color: #003366; font-size: 1.5em; margin-top: 30px; margin-bottom: 15px;",
  h4: "font-family: 'Antonio', sans-serif; font-weight: bold; color: #003366; font-size: 1.3em; margin-top: 25px; margin-bottom: 10px;",
  p: "font-family: 'PT Sans', sans-serif; color: #333333; margin-bottom: 15px;",
  pLead: "font-family: 'PT Sans', sans-serif; font-size: 1.1em; line-height: 1.6; max-width: 700px; margin: 0 auto;",
  link: "color: #003366; font-weight: bold; text-decoration: none;",
  listUl: "list-style: none; padding: 0; margin-top: 15px;",
  listOl: "list-style: decimal; padding-left: 20px; margin-top: 15px;",
  li: "font-family: 'PT Sans', sans-serif; color: #333333; margin-bottom: 10px;",
  liIcon: "color: #ff6600; font-weight: bold; margin-right: 8px;",
  heroContainer: "background: linear-gradient(135deg, #003366 0%, #ff6600 100%); color: #ffffff; padding: 40px; border-radius: 8px; margin-bottom: 30px; text-align: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);",
  tableWrapper: "overflow-x: auto; margin: 2rem 0; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 51, 102, 0.1); background: white;",
  table: "width: 100%; border-collapse: collapse; min-width: 600px; font-family: 'PT Sans', sans-serif;",
  th: "background: #003366; color: white; font-weight: 600; text-transform: uppercase; font-size: 0.875rem; padding: 1rem 1.5rem; text-align: left;",
  td: "padding: 1rem 1.5rem; text-align: left; border-bottom: 1px solid #e2e8f0; color: #333333;",
  tocNav: "background-color: #f8f8f8; border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 12px; margin-bottom: 3rem; margin-top: 1rem;",
  tocHeader: "margin-top: 0; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-family: 'Antonio', sans-serif; font-weight: bold;",
  tocUl: "list-style: none; padding: 0; margin: 0;",
  tocLi: "margin-bottom: 0.5rem; font-family: 'PT Sans', sans-serif;",
  tocLink: "color: #333333; text-decoration: none; display: block; padding: 0.25rem 0;",
  strongBlue: "color: #003366;",
  strongOrange: "color: #ff6600;"
};

// ============================================================================
// COMPONENT RENDERERS
// ============================================================================

function renderSectionHeader(block: HeadingBlock, variant: string): string {
  const tag = `h${block.level}`;
  // @ts-ignore: index logic
  const style = STYLES[`h${block.level}`] || STYLES.h2;

  // Hero H1 is handled separately in renderBlocks, but if we encounter H1 here:
  if (block.level === 1) {
    return `<div style="${STYLES.heroContainer}">
        <h1 id="${block.id}" style="${STYLES.h1}">${escapeHtml(block.text)}</h1>
     </div>`;
  }

  return `<${tag} id="${block.id}" style="${style}">${escapeHtml(block.text)}</${tag}>`;
}

function renderParagraph(block: ParagraphBlock, variant: string): string {
  // Use original HTML if available (preserves inline formatting) usually
  // But we want to inject inline styles into strong tags if possible, or just rely on CSS
  let content = block.html
    ? block.html.replace(/<\/?p[^>]*>/gi, "")
    : escapeHtml(block.text);

  // Simple regex replace for strong/bold to add colors (optional "WOW" factor)
  // content = content.replace(/<strong>/g, `<strong style="${STYLES.strongBlue}">`);

  const style = variant === "lead" ? STYLES.pLead : STYLES.p;
  return `<p style="${style}">${content}</p>`;
}

function renderList(block: ListBlock, variant: string): string {
  const tag = block.ordered ? "ol" : "ul";
  const listStyle = block.ordered ? STYLES.listOl : STYLES.listUl;

  const items = block.items.map(item => {
    // Add checkmark for unordered lists (NetCo style)
    const prefix = !block.ordered ? `<span style="${STYLES.liIcon}">&#x2713;</span> ` : "";
    return `<li style="${STYLES.li}">${prefix}${escapeHtml(item)}</li>`;
  }).join("\n    ");

  return `<${tag} style="${listStyle}">
    ${items}
  </${tag}>`;
}

function renderTable(block: TableBlock, variant: string): string {
  const headerCells = block.headers.map(h => `<th style="${STYLES.th}">${escapeHtml(h)}</th>`).join("");
  const headerRow = block.headers.length > 0 ? `<thead><tr>${headerCells}</tr></thead>` : "";

  const bodyRows = block.rows.map(row => {
    const cells = row.map(cell => `<td style="${STYLES.td}">${escapeHtml(cell)}</td>`).join("");
    return `<tr>${cells}</tr>`;
  }).join("\n      ");

  return `<div style="${STYLES.tableWrapper}">
  <table style="${STYLES.table}">
    ${headerRow}
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
</div>`;
}

function renderContrastPair(
  leftBlock: ParagraphBlock,
  rightBlock: ParagraphBlock,
  variant: string,
  labelLeft?: string,
  labelRight?: string
): string {
  // Inline style for grid
  const gridStyle = "display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: 3rem 0; align-items: start;";
  const sideStyle = "background: #f8fbff; padding: 2rem; border-radius: 12px; height: 100%; box-sizing: border-box;";
  const leftSideStyle = "background: #003366; color: white; padding: 2rem; border-radius: 12px; height: 100%; box-sizing: border-box;";
  const labelStyle = "display: inline-block; margin-bottom: 1rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.8; font-weight: 700;";

  const leftContent = leftBlock.html ? leftBlock.html.replace(/<\/?p[^>]*>/gi, "") : escapeHtml(leftBlock.text);
  const rightContent = rightBlock.html ? rightBlock.html.replace(/<\/?p[^>]*>/gi, "") : escapeHtml(rightBlock.text);

  return `<div style="${gridStyle}">
  <div style="${leftSideStyle}">
    ${labelLeft ? `<div style="${labelStyle} color: white;">${escapeHtml(labelLeft)}</div>` : ""}
    <p style="margin: 0; color: white; font-family: 'PT Sans', sans-serif;">${leftContent}</p>
  </div>
  <div style="${sideStyle} border: 1px solid #e2e8f0;">
    ${labelRight ? `<div style="${labelStyle} color: #64748b;">${escapeHtml(labelRight)}</div>` : ""}
    <p style="margin: 0; font-family: 'PT Sans', sans-serif;">${rightContent}</p>
  </div>
</div>`;
}

function renderQuote(block: QuoteBlock): string {
  const style = "background: #f0f7ff; border-left: 5px solid #003366; padding: 1.5rem; border-radius: 8px; margin: 2rem 0; font-style: italic; font-family: 'PT Sans', sans-serif; color: #333333;";
  return `<blockquote style="${style}">${escapeHtml(block.text)}</blockquote>`;
}

function renderImage(block: ImageBlock): string {
  const src = block.meta?.src || "";
  const alt = block.meta?.alt || "";
  const style = "max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); margin: 2rem 0;";
  return `<img src="${src}" alt="${escapeHtml(alt)}" style="${style}" loading="lazy">`;
}

function renderCode(block: CodeBlock): string {
  const style = "background: #1e293b; color: #e2e8f0; padding: 1.5rem; border-radius: 8px; overflow-x: auto; font-family: monospace; line-height: 1.5;";
  return `<pre style="${style}"><code>${escapeHtml(block.code)}</code></pre>`;
}

function renderHr(): string {
  return `<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 3rem 0;">`;
}

// ============================================================================
// TABLE OF CONTENTS
// ============================================================================

function renderToc(blocks: Block[]): string {
  const headings = blocks.filter(b => b.type === "heading" && (b as HeadingBlock).level <= 3) as HeadingBlock[];
  if (headings.length < 3) return "";

  const items = headings.map(h => {
    const indent = h.level === 2 ? "" : h.level === 3 ? "padding-left: 1rem;" : "";
    return `<li style="${STYLES.tocLi} ${indent}"><a href="#${h.id}" style="${STYLES.tocLink}">${escapeHtml(h.text)}</a></li>`;
  }).join("\n    ");

  return `<nav style="${STYLES.tocNav}">
  <h4 style="${STYLES.tocHeader}">Inhaltsverzeichnis</h4>
  <ul style="${STYLES.tocUl}">
    ${items}
  </ul>
</nav>`;
}

// ============================================================================
// MAIN RENDERER
// ============================================================================

export interface RenderOptions {
  includeToc?: boolean;
}

export function renderBlocks(
  blocks: Block[],
  recipe: Recipe,
  options: RenderOptions = {}
): string {
  const { includeToc = recipe.toc } = options;

  // Build layout map
  const layoutMap = new Map<string, StandardLayoutItem>();
  const contrastPairs: ContrastPairItem[] = [];
  const consumedBlockIds = new Set<string>();

  for (const item of recipe.layout) {
    if (isContrastPair(item)) {
      contrastPairs.push(item);
      consumedBlockIds.add(item.leftBlockId);
      consumedBlockIds.add(item.rightBlockId);
    } else if (isStandardLayoutItem(item)) {
      layoutMap.set(item.blockId, item);
    }
  }

  const blockMap = new Map<string, Block>();
  for (const block of blocks) blockMap.set(block.id, block);

  const parts: string[] = [];

  if (includeToc) {
    const toc = renderToc(blocks);
    if (toc) parts.push(toc);
  }

  // Handle Hero Section Manually (H1 + P)
  // We basically check if the first block is H1, if so, we verify if second is P
  // and wrap them together using the specific Hero Design.

  let startIndex = 0;
  if (blocks.length > 0 && blocks[0].type === "heading" && (blocks[0] as HeadingBlock).level === 1) {
    const h1 = blocks[0] as HeadingBlock;
    let pLead: ParagraphBlock | null = null;

    if (blocks.length > 1 && blocks[1].type === "paragraph") {
      pLead = blocks[1] as ParagraphBlock;
      startIndex = 2; // Skip first two
    } else {
      startIndex = 1; // Skip only H1
    }

    // Render Hero
    const leadHtml = pLead ? `<p style="${STYLES.pLead}">${pLead.html ? pLead.html.replace(/<\/?p>/g, "") : escapeHtml(pLead.text)}</p>` : "";

    parts.push(`<div style="${STYLES.heroContainer}">
        <h1 id="${h1.id}" style="${STYLES.h1}">${escapeHtml(h1.text)}</h1>
        ${leadHtml}
    </div>`);
  }

  // Render remaining blocks
  for (let i = startIndex; i < blocks.length; i++) {
    const block = blocks[i];

    if (consumedBlockIds.has(block.id)) {
      const pair = contrastPairs.find(p => p.leftBlockId === block.id);
      if (pair) {
        const leftBlock = blockMap.get(pair.leftBlockId) as ParagraphBlock | undefined;
        const rightBlock = blockMap.get(pair.rightBlockId) as ParagraphBlock | undefined;
        if (leftBlock && rightBlock) {
          parts.push(renderContrastPair(leftBlock, rightBlock, pair.variant, pair.labelLeft, pair.labelRight));
          continue;
        }
      } else {
        continue;
      }
    }

    const override = layoutMap.get(block.id);
    const variant = override?.variant || "normal";

    switch (block.type) {
      case "heading": parts.push(renderSectionHeader(block as HeadingBlock, variant)); break;
      case "paragraph": parts.push(renderParagraph(block as ParagraphBlock, variant)); break;
      case "list": parts.push(renderList(block as ListBlock, variant)); break;
      case "table": parts.push(renderTable(block as TableBlock, variant)); break;
      case "quote": parts.push(renderQuote(block as QuoteBlock)); break;
      case "image": parts.push(renderImage(block as ImageBlock)); break;
      case "code": parts.push(renderCode(block as CodeBlock)); break;
      case "hr": parts.push(renderHr()); break;
    }
  }

  return parts.join("\n\n");
}

export function renderBlocksWithFallback(blocks: Block[], recipe: Recipe | null): string {
  const effectiveRecipe: Recipe = recipe || { recipeVersion: "v1", theme: "minimal-clean", toc: true, layout: [] };
  return renderBlocks(blocks, effectiveRecipe);
}
