import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Convex Client for Inngest Agent Functions
 *
 * Uses ConvexHttpClient which works in server-side environments (Vercel Functions).
 * All mutations/queries are made via HTTP to the Convex backend.
 *
 * Uses lazy initialization to ensure environment variables are loaded first.
 */

let _convex: ConvexHttpClient | null = null;

/**
 * Get the Convex HTTP client (lazy initialization)
 */
function getConvexClient(): ConvexHttpClient {
  if (!_convex) {
    const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is not set");
    }
    _convex = new ConvexHttpClient(convexUrl);
  }
  return _convex;
}

// Export as a proxy that lazily initializes
export const convex = new Proxy({} as ConvexHttpClient, {
  get(_, prop) {
    const client = getConvexClient();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// Re-export types for convenience
export type { Id };
export { api };

/**
 * Helper to safely get environment variables
 */
export function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Agent cost definitions (in credits)
 */
export const AGENT_CREDITS = {
  "seo-writer": 10,
  "html-designer": 3,
  "wp-publisher": 1,
  "internal-linker": 5,
  "social-creator": 5,
  "ad-copy-writer": 4,
  "press-release": 6,
  "newsletter": 5,
  "image-generator": 8,
  "video-creator": 10,
  "carousel-designer": 6,
  "press-outreach": 4,
  "link-building": 4,
  "editorial-researcher": 3,
  "content-translator": 7,
  "company-social": 3,
  "employee-advocacy": 3,
  "linkbait-creator": 6,
} as const;

export type AgentId = keyof typeof AGENT_CREDITS;

/**
 * Calculate estimated API cost in cents based on token usage
 * Pricing: Claude Sonnet ~$3/1M input, $15/1M output
 */
export function calculateCostCents(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * 300; // $3 per 1M = 300 cents
  const outputCost = (outputTokens / 1_000_000) * 1500; // $15 per 1M = 1500 cents
  return Math.ceil(inputCost + outputCost);
}
