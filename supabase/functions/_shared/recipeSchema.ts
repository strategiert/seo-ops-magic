/**
 * Recipe Schema with Zod Validation
 * Defines the structure for LLM layout decisions
 */

import { z } from "https://esm.sh/zod@3.23.8";
import { seededPick } from "./seed.ts";

// ============================================================================
// ENUMS
// ============================================================================

export const ThemeEnum = z.enum([
  "editorial-bold",   // Serif headings, strong contrast, larger spacing
  "minimal-clean",    // Minimal borders, clean sans-serif
  "tech-neon",        // Modern tech look with accent colors
]);

export const ComponentEnum = z.enum([
  "sectionHeader",
  "paragraph",
  "list",
  "table",
  "contrastPair",
  "callout",
  "takeaways",
  "quote",
  "image",
]);

// ============================================================================
// COMPONENT VARIANTS
// ============================================================================

export const SectionHeaderVariants = z.enum(["badge", "underline", "minimal"]);
export const ParagraphVariants = z.enum(["normal", "lead", "compact"]);
export const ListVariants = z.enum(["checklist", "steps", "cards", "plain"]);
export const TableVariants = z.enum(["comparisonSticky", "zebra", "plain"]);
export const ContrastPairVariants = z.enum(["splitCards", "splitMinimal"]);
export const CalloutVariants = z.enum(["tip", "warning", "info"]);
export const TakeawaysVariants = z.enum(["cards", "bullets"]);

// ============================================================================
// LAYOUT ITEMS
// ============================================================================

// Standard block mapping
export const StandardLayoutItemSchema = z.object({
  blockId: z.string(),
  component: ComponentEnum,
  variant: z.string(),
});

// Special composite: Contrast Pair (two paragraphs side by side)
export const ContrastPairItemSchema = z.object({
  component: z.literal("contrastPair"),
  leftBlockId: z.string(),
  rightBlockId: z.string(),
  variant: ContrastPairVariants,
  labelLeft: z.string().optional(),
  labelRight: z.string().optional(),
});

// Combined layout item
export const LayoutItemSchema = z.union([
  StandardLayoutItemSchema,
  ContrastPairItemSchema,
]);

// ============================================================================
// RECIPE SCHEMA
// ============================================================================

export const RecipeSchema = z.object({
  recipeVersion: z.literal("v1"),
  theme: ThemeEnum,
  toc: z.boolean().default(true),
  layout: z.array(LayoutItemSchema).default([]),
});

export type Recipe = z.infer<typeof RecipeSchema>;
export type Theme = z.infer<typeof ThemeEnum>;
export type LayoutItem = z.infer<typeof LayoutItemSchema>;
export type StandardLayoutItem = z.infer<typeof StandardLayoutItemSchema>;
export type ContrastPairItem = z.infer<typeof ContrastPairItemSchema>;

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
  success: boolean;
  recipe?: Recipe;
  errors?: z.ZodError;
}

/**
 * Validate and parse LLM JSON output
 */
export function validateRecipe(json: unknown): ValidationResult {
  const result = RecipeSchema.safeParse(json);

  if (result.success) {
    return { success: true, recipe: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Generate a fallback recipe when LLM fails
 * Uses seeded theme selection for consistency
 */
export function generateFallbackRecipe(articleId: string): Recipe {
  const themes: Theme[] = ["editorial-bold", "minimal-clean", "tech-neon"];
  const theme = seededPick(articleId, themes);

  return {
    recipeVersion: "v1",
    theme,
    toc: true,
    layout: [], // Empty layout = use default component mappings
  };
}

/**
 * Check if a layout item is a contrast pair
 */
export function isContrastPair(item: LayoutItem): item is ContrastPairItem {
  return item.component === "contrastPair" && "leftBlockId" in item;
}

/**
 * Check if a layout item is a standard block mapping
 */
export function isStandardLayoutItem(item: LayoutItem): item is StandardLayoutItem {
  return "blockId" in item && item.component !== "contrastPair";
}
