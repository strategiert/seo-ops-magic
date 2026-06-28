import type { Id } from "../_generated/dataModel";

export const TIERS = {
  free: {
    monthlyAllowance: 50,
    concurrencyLimit: 1,
    enabledAgents: ["seo-writer"],
  },
  core: {
    monthlyAllowance: 500,
    concurrencyLimit: 3,
    enabledAgents: [
      "seo-writer",
      "html-designer",
      "wp-publisher",
      "internal-linker",
    ],
  },
  growth: {
    monthlyAllowance: 2000,
    concurrencyLimit: 5,
    enabledAgents: [
      "seo-writer",
      "html-designer",
      "wp-publisher",
      "internal-linker",
      "social-creator",
      "ad-copy-writer",
      "newsletter",
      "image-generator",
    ],
  },
  enterprise: {
    monthlyAllowance: 10000,
    concurrencyLimit: 10,
    enabledAgents: [
      "seo-writer",
      "html-designer",
      "wp-publisher",
      "internal-linker",
      "social-creator",
      "ad-copy-writer",
      "newsletter",
      "image-generator",
      "press-release",
      "outreach-intelligence",
      "outreach-strategy",
      "press-outreach",
      "link-building",
      "editorial-researcher",
      "content-translator",
      "video-creator",
      "carousel-designer",
      "company-social",
      "employee-advocacy",
      "linkbait-creator",
    ],
  },
} as const;

export type TierName = keyof typeof TIERS;

export const DEFAULT_TIER: TierName = "enterprise";

export function normalizeTier(tier?: string): TierName {
  return tier && tier in TIERS ? (tier as TierName) : DEFAULT_TIER;
}

export function getTierConfig(tier?: string): (typeof TIERS)[TierName] {
  return TIERS[normalizeTier(tier)];
}

export function createInitialCreditDocument(
  userId: string,
  workspaceId: Id<"workspaces">,
  tier?: string
) {
  const tierName = normalizeTier(tier);
  const tierConfig = TIERS[tierName];

  return {
    userId,
    workspaceId,
    balance: tierConfig.monthlyAllowance,
    tier: tierName,
    monthlyAllowance: tierConfig.monthlyAllowance,
    resetDay: Math.min(new Date().getDate(), 28),
    lastResetAt: Date.now(),
    enabledAgents: [...tierConfig.enabledAgents],
    concurrencyLimit: tierConfig.concurrencyLimit,
  };
}
