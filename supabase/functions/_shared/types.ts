/**
 * Block Types for Article Content Extraction
 */

export type BlockType = 'heading' | 'paragraph' | 'list' | 'table' | 'quote' | 'image' | 'code' | 'hr';

export interface BlockBase {
  id: string;
  type: BlockType;
  text?: string;
  html?: string;
  meta?: Record<string, unknown>;
}

export interface HeadingBlock extends BlockBase {
  type: 'heading';
  level: 1 | 2 | 3 | 4;
  text: string;
}

export interface ParagraphBlock extends BlockBase {
  type: 'paragraph';
  text: string;
}

export interface ListBlock extends BlockBase {
  type: 'list';
  ordered: boolean;
  items: string[];
}

export interface TableBlock extends BlockBase {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface QuoteBlock extends BlockBase {
  type: 'quote';
  text: string;
}

export interface ImageBlock extends BlockBase {
  type: 'image';
  meta: {
    src: string;
    alt: string;
  };
}

export interface CodeBlock extends BlockBase {
  type: 'code';
  language?: string;
  code: string;
}

export interface HrBlock extends BlockBase {
  type: 'hr';
}

export type Block = HeadingBlock | ParagraphBlock | ListBlock | TableBlock | QuoteBlock | ImageBlock | CodeBlock | HrBlock;

/**
 * Article Metadata for LLM Context
 */
export interface ArticleMeta {
  id: string;
  title: string;
  metaDescription?: string;
  primaryKeyword?: string;
}

/**
 * Recipe Types (see recipeSchema.ts for validation)
 */
export type Theme = 'editorial-bold' | 'minimal-clean' | 'tech-neon';

export type ComponentType =
  | 'sectionHeader'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'contrastPair'
  | 'callout'
  | 'takeaways'
  | 'quote'
  | 'image';

export interface LayoutItem {
  blockId: string;
  component: ComponentType;
  variant: string;
}

export interface ContrastPairItem {
  component: 'contrastPair';
  leftBlockId: string;
  rightBlockId: string;
  variant: 'splitCards' | 'splitMinimal';
  labelLeft?: string;
  labelRight?: string;
}

export interface Recipe {
  recipeVersion: 'v1';
  theme: Theme;
  toc: boolean;
  layout: (LayoutItem | ContrastPairItem)[];
}
