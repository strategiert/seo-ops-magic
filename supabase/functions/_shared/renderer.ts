/**
 * Deterministic HTML Renderer
 * Renders blocks to HTML using recipe layout decisions
 */

import type { Block, HeadingBlock, ParagraphBlock, ListBlock, TableBlock, QuoteBlock, ImageBlock, CodeBlock } from "./types.ts";
import type { Recipe, LayoutItem, ContrastPairItem, StandardLayoutItem } from "./recipeSchema.ts";
import { isContrastPair, isStandardLayoutItem } from "./recipeSchema.ts";
import { escapeHtml } from "./sanitize.ts";

// ============================================================================
// COMPONENT RENDERERS
// ============================================================================

function renderSectionHeader(block: HeadingBlock, variant: string): string {
  const tag = `h${block.level}`;
  const variantClass = variant || "minimal";
  return `<div class="section-header ${variantClass}">
    <${tag} id="${block.id}">${escapeHtml(block.text)}</${tag}>
  </div>`;
}

function renderParagraph(block: ParagraphBlock, variant: string): string {
  const cls = variant === "lead" ? "lead" : variant === "compact" ? "compact" : "";
  // Use original HTML if available (preserves inline formatting)
  const content = block.html
    ? block.html.replace(/<\/?p[^>]*>/gi, "")
    : escapeHtml(block.text);
  return `<p class="${cls}">${content}</p>`;
}

function renderList(block: ListBlock, variant: string): string {
  const wrapperClass = `list-${variant || "plain"}`;
  const tag = block.ordered ? "ol" : "ul";

  const items = block.items.map(item => `<li>${escapeHtml(item)}</li>`).join("\n    ");

  return `<div class="${wrapperClass}">
  <${tag}>
    ${items}
  </${tag}>
</div>`;
}

function renderTable(block: TableBlock, variant: string): string {
  const tableClass = variant === "comparisonSticky" ? "table-comparison" :
    variant === "zebra" ? "table-zebra" : "";

  const headerCells = block.headers.map(h => `<th>${escapeHtml(h)}</th>`).join("");
  const headerRow = block.headers.length > 0 ? `<thead><tr>${headerCells}</tr></thead>` : "";

  const bodyRows = block.rows.map(row => {
    const cells = row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("");
    return `<tr>${cells}</tr>`;
  }).join("\n      ");

  return `<div class="table-wrapper ${tableClass}">
  <table>
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
  const variantClass = variant === "splitMinimal" ? "contrast-pair-minimal" : "";

  const leftContent = leftBlock.html
    ? leftBlock.html.replace(/<\/?p[^>]*>/gi, "")
    : escapeHtml(leftBlock.text);

  const rightContent = rightBlock.html
    ? rightBlock.html.replace(/<\/?p[^>]*>/gi, "")
    : escapeHtml(rightBlock.text);

  return `<div class="contrast-pair ${variantClass}">
  <div class="side side-left">
    ${labelLeft ? `<div class="label">${escapeHtml(labelLeft)}</div>` : ""}
    <p>${leftContent}</p>
  </div>
  <div class="side side-right">
    ${labelRight ? `<div class="label">${escapeHtml(labelRight)}</div>` : ""}
    <p>${rightContent}</p>
  </div>
</div>`;
}

function renderQuote(block: QuoteBlock): string {
  return `<blockquote>${escapeHtml(block.text)}</blockquote>`;
}

function renderImage(block: ImageBlock): string {
  const src = block.meta?.src || "";
  const alt = block.meta?.alt || "";
  return `<img src="${src}" alt="${escapeHtml(alt)}" class="article-image" loading="lazy">`;
}

function renderCode(block: CodeBlock): string {
  const langClass = block.language ? ` class="language-${block.language}"` : "";
  return `<pre><code${langClass}>${escapeHtml(block.code)}</code></pre>`;
}

function renderHr(): string {
  return `<hr>`;
}

// ============================================================================
// TABLE OF CONTENTS
// ============================================================================

function renderToc(blocks: Block[]): string {
  const headings = blocks.filter(b => b.type === "heading" && (b as HeadingBlock).level <= 3) as HeadingBlock[];

  if (headings.length < 3) return ""; // Don't show TOC for very short articles

  const items = headings.map(h => {
    const indent = h.level === 2 ? "" : h.level === 3 ? "padding-left: 1rem;" : "";
    return `<li style="${indent}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`;
  }).join("\n    ");

  return `<nav class="toc">
  <h4>Inhaltsverzeichnis</h4>
  <ul>
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

/**
 * Render blocks to HTML body content
 */
export function renderBlocks(
  blocks: Block[],
  recipe: Recipe,
  options: RenderOptions = {}
): string {
  const { includeToc = recipe.toc } = options;

  // Build layout override map
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

  // Build block lookup
  const blockMap = new Map<string, Block>();
  for (const block of blocks) {
    blockMap.set(block.id, block);
  }

  // Render parts
  const parts: string[] = [];

  // Add TOC if enabled
  if (includeToc) {
    const toc = renderToc(blocks);
    if (toc) parts.push(toc);
  }

  // Track first paragraph for lead styling
  let isFirstParagraph = true;

  // Render blocks in order
  for (const block of blocks) {
    // Skip if consumed by contrast pair
    if (consumedBlockIds.has(block.id)) {
      // Check if this is the left side of a contrast pair
      const pair = contrastPairs.find(p => p.leftBlockId === block.id);
      if (pair) {
        const leftBlock = blockMap.get(pair.leftBlockId) as ParagraphBlock | undefined;
        const rightBlock = blockMap.get(pair.rightBlockId) as ParagraphBlock | undefined;

        if (leftBlock && rightBlock) {
          parts.push(renderContrastPair(
            leftBlock,
            rightBlock,
            pair.variant,
            pair.labelLeft,
            pair.labelRight
          ));
          continue; // Successfully rendered as pair
        }
      } else {
        // This is the right block of a pair, or the left block's pair was already rendered
        continue;
      }

      // If we fall through here, the block was marked as consumed but couldn't be rendered
      // as part of a pair (e.g. missing partner). We continue to normal rendering.
    }

    // Get layout override
    const override = layoutMap.get(block.id);

    switch (block.type) {
      case "heading":
        parts.push(renderSectionHeader(
          block,
          override?.variant || "minimal"
        ));
        break;

      case "paragraph": {
        let variant = override?.variant || "normal";
        // First paragraph gets lead styling if no override
        if (isFirstParagraph && !override) {
          variant = "lead";
          isFirstParagraph = false;
        }
        parts.push(renderParagraph(block, variant));
        break;
      }

      case "list":
        parts.push(renderList(
          block,
          override?.variant || "plain"
        ));
        break;

      case "table":
        parts.push(renderTable(
          block,
          override?.variant || "zebra"
        ));
        break;

      case "quote":
        parts.push(renderQuote(block));
        break;

      case "image":
        parts.push(renderImage(block));
        break;

      case "code":
        parts.push(renderCode(block));
        break;

      case "hr":
        parts.push(renderHr());
        break;
    }
  }

  return parts.join("\n\n");
}

/**
 * Render with fallback (no recipe = use defaults)
 */
export function renderBlocksWithFallback(
  blocks: Block[],
  recipe: Recipe | null
): string {
  const effectiveRecipe: Recipe = recipe || {
    recipeVersion: "v1",
    theme: "minimal-clean",
    toc: true,
    layout: [],
  };

  return renderBlocks(blocks, effectiveRecipe);
}
