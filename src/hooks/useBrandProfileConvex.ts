import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useWorkspaceConvex } from "./useWorkspaceConvex";

/**
 * Convex-based Brand Profile Hook
 *
 * Replaces the Supabase-based useBrandProfile hook.
 * Uses real-time Convex subscriptions instead of polling!
 */

interface BrandVoice {
  tone: string[];
  personality_traits: string[];
  writing_style: {
    formality?: string;
    sentence_length?: string;
    vocabulary_level?: string;
    use_of_jargon?: string;
  };
}

interface Product {
  name: string;
  description: string;
  price?: string;
  features: string[];
  category?: string;
}

interface Service {
  name: string;
  description: string;
  pricing_model?: string;
  target_audience?: string;
}

interface Persona {
  name: string;
  demographics: string;
  pain_points: string[];
  goals: string[];
  preferred_channels: string[];
}

interface BrandKeywords {
  primary: string[];
  secondary: string[];
  long_tail: string[];
}

interface VisualIdentity {
  primary_color?: string;
  secondary_colors?: string[];
  logo_description?: string;
  imagery_style?: string;
}

export interface BrandProfile {
  _id: Id<"brandProfiles">;
  projectId: Id<"projects">;
  brandName?: string;
  tagline?: string;
  missionStatement?: string;
  brandStory?: string;
  brandVoice?: BrandVoice;
  products?: Product[];
  services?: Service[];
  personas?: Persona[];
  brandKeywords?: BrandKeywords;
  competitors?: any[];
  visualIdentity?: VisualIdentity;
  crawlStatus?: string;
  crawlError?: string;
  crawlJobId?: string;
  lastCrawlAt?: number;
  lastAnalysisAt?: number;
  openaiVectorStoreId?: string;
}

export function useBrandProfileConvex() {
  const { currentProject } = useWorkspaceConvex();

  // Real-time subscription to brand profile - NO POLLING NEEDED!
  const brandProfile = useQuery(
    api.tables.brandProfiles.getByProject,
    currentProject ? { projectId: currentProject._id } : "skip"
  ) as BrandProfile | null | undefined;

  // Actions
  const startCrawlAction = useAction(api.actions.firecrawl.startCrawl);
  const analyzeBrandAction = useAction(api.actions.gemini.analyzeBrand);
  const syncVectorStoreAction = useAction(api.actions.openai?.syncVectorStore);

  // Derived state
  const loading = brandProfile === undefined;
  const crawlStatus = brandProfile?.crawlStatus ?? "pending";

  const isIdle = crawlStatus === "pending" || crawlStatus === "error";
  const isCrawling = crawlStatus === "crawling";
  const isAnalyzing = crawlStatus === "analyzing";
  const isCompleted = crawlStatus === "completed";

  /**
   * Trigger website crawl
   */
  const triggerCrawl = async (
    websiteUrl: string,
    maxPages?: number
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentProject) {
      return { success: false, error: "No project selected" };
    }

    const result = await startCrawlAction({
      projectId: currentProject._id,
      websiteUrl,
      maxPages,
    });

    return result;
  };

  /**
   * Trigger brand analysis
   */
  const triggerAnalysis = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!currentProject || !brandProfile) {
      return { success: false, error: "No project or brand profile" };
    }

    const result = await analyzeBrandAction({
      projectId: currentProject._id,
      brandProfileId: brandProfile._id,
    });

    return result;
  };

  /**
   * Sync to OpenAI Vector Store
   */
  const syncVectorStore = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!syncVectorStoreAction) {
      return { success: false, error: "Vector store action not available" };
    }

    if (!currentProject || !brandProfile) {
      return { success: false, error: "No project or brand profile" };
    }

    const result = await syncVectorStoreAction({
      projectId: currentProject._id,
      brandProfileId: brandProfile._id,
    });

    return result;
  };

  /**
   * Get formatted brand context for content generation
   */
  const getBrandContext = (): string => {
    if (!brandProfile) return "";

    const parts: string[] = [];

    if (brandProfile.brandName) {
      parts.push(`Marke: ${brandProfile.brandName}`);
    }
    if (brandProfile.tagline) {
      parts.push(`Slogan: ${brandProfile.tagline}`);
    }

    if (brandProfile.brandVoice) {
      if (brandProfile.brandVoice.tone?.length) {
        parts.push(`Tonalität: ${brandProfile.brandVoice.tone.join(", ")}`);
      }
      if (brandProfile.brandVoice.personality_traits?.length) {
        parts.push(
          `Persönlichkeit: ${brandProfile.brandVoice.personality_traits.join(", ")}`
        );
      }
    }

    if (brandProfile.products?.length) {
      const topProducts = brandProfile.products.slice(0, 3);
      parts.push(`Produkte: ${topProducts.map((p) => p.name).join(", ")}`);
    }

    if (brandProfile.services?.length) {
      const topServices = brandProfile.services.slice(0, 3);
      parts.push(`Leistungen: ${topServices.map((s) => s.name).join(", ")}`);
    }

    if (brandProfile.brandKeywords?.primary?.length) {
      parts.push(
        `Marken-Keywords: ${brandProfile.brandKeywords.primary.join(", ")}`
      );
    }

    return parts.join("\n");
  };

  return {
    // Data
    brandProfile,
    loading,

    // Status
    crawlStatus,
    isIdle,
    isCrawling,
    isAnalyzing,
    isCompleted,

    // Actions
    triggerCrawl,
    triggerAnalysis,
    syncVectorStore,

    // Helpers
    getBrandContext,
  };
}
