import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";
import type { Json } from "@/integrations/supabase/types";

// Brand Profile Types
export interface BrandVoice {
  tone: string[];
  personality_traits: string[];
  writing_style: {
    formality?: string;
    sentence_length?: string;
    vocabulary_level?: string;
    use_of_jargon?: string;
  };
}

export interface Product {
  name: string;
  description: string;
  price?: string;
  features: string[];
  category?: string;
}

export interface Service {
  name: string;
  description: string;
  pricing_model?: string;
  target_audience?: string;
}

export interface Persona {
  name: string;
  demographics: string;
  pain_points: string[];
  goals: string[];
  preferred_channels: string[];
}

export interface BrandKeywords {
  primary: string[];
  secondary: string[];
  long_tail: string[];
}

export interface Competitor {
  name: string;
  domain: string;
  strengths: string[];
  weaknesses: string[];
}

export interface VisualIdentity {
  primary_color?: string;
  secondary_colors?: string[];
  logo_description?: string;
  imagery_style?: string;
}

export interface InternalLink {
  url: string;
  title: string;
  page_type?: string;
}

export interface BrandProfile {
  id: string;
  project_id: string;
  brand_name: string | null;
  tagline: string | null;
  mission_statement: string | null;
  brand_story: string | null;
  brand_voice: BrandVoice;
  products: Product[];
  services: Service[];
  personas: Persona[];
  brand_keywords: BrandKeywords;
  competitors: Competitor[];
  visual_identity: VisualIdentity;
  internal_links: InternalLink[];
  current_projects: Json;
  openai_vector_store_id: string | null;
  crawl_status: string;
  crawl_error: string | null;
  last_crawl_at: string | null;
  last_analysis_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CrawlStatus = "pending" | "crawling" | "analyzing" | "completed" | "error";

export interface UseBrandProfileReturn {
  brandProfile: BrandProfile | null;
  loading: boolean;
  error: string | null;
  crawlStatus: CrawlStatus;
  triggerCrawl: (websiteUrl: string, maxPages?: number) => Promise<{ success: boolean; error?: string }>;
  triggerAnalysis: () => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: Partial<BrandProfile>) => Promise<{ success: boolean; error?: string }>;
  syncVectorStore: () => Promise<{ success: boolean; error?: string }>;
  resetProfile: () => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
}

// Helper to safely parse JSONB fields
function parseJsonField<T>(value: Json | null, defaultValue: T): T {
  if (!value) return defaultValue;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(value as string) as T;
  } catch {
    return defaultValue;
  }
}

export function useBrandProfile(): UseBrandProfileReturn {
  const { currentProject } = useWorkspace();
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load brand profile from database
  const loadProfile = useCallback(async () => {
    if (!currentProject?.id) {
      setBrandProfile(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("brand_profiles")
        .select("*")
        .eq("project_id", currentProject.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        // Transform database row to typed object
        const profile: BrandProfile = {
          id: data.id,
          project_id: data.project_id,
          brand_name: data.brand_name,
          tagline: data.tagline,
          mission_statement: data.mission_statement,
          brand_story: data.brand_story,
          brand_voice: parseJsonField<BrandVoice>(data.brand_voice, {
            tone: [],
            personality_traits: [],
            writing_style: {},
          }),
          products: parseJsonField<Product[]>(data.products, []),
          services: parseJsonField<Service[]>(data.services, []),
          personas: parseJsonField<Persona[]>(data.personas, []),
          brand_keywords: parseJsonField<BrandKeywords>(data.brand_keywords, {
            primary: [],
            secondary: [],
            long_tail: [],
          }),
          competitors: parseJsonField<Competitor[]>(data.competitors, []),
          visual_identity: parseJsonField<VisualIdentity>(data.visual_identity, {}),
          internal_links: parseJsonField<InternalLink[]>(data.internal_links, []),
          current_projects: data.current_projects,
          openai_vector_store_id: data.openai_vector_store_id,
          crawl_status: data.crawl_status || "pending",
          crawl_error: data.crawl_error,
          last_crawl_at: data.last_crawl_at,
          last_analysis_at: data.last_analysis_at,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        setBrandProfile(profile);
      } else {
        setBrandProfile(null);
      }
    } catch (err) {
      console.error("Error loading brand profile:", err);
      setError(err instanceof Error ? err.message : "Fehler beim Laden des Brand-Profils");
      setBrandProfile(null);
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id]);

  // Trigger website crawl
  const triggerCrawl = useCallback(
    async (websiteUrl: string, maxPages = 20): Promise<{ success: boolean; error?: string }> => {
      if (!currentProject?.id) {
        return { success: false, error: "Kein Projekt ausgewählt" };
      }

      try {
        const response = await supabase.functions.invoke("brand-crawl", {
          body: {
            projectId: currentProject.id,
            websiteUrl,
            maxPages,
          },
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        if (!response.data.success && response.data.error) {
          throw new Error(response.data.error);
        }

        // Refresh profile to get updated status
        await loadProfile();

        return { success: true };
      } catch (err) {
        console.error("Error triggering crawl:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Crawl fehlgeschlagen",
        };
      }
    },
    [currentProject?.id, loadProfile]
  );

  // Trigger AI analysis
  const triggerAnalysis = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!currentProject?.id || !brandProfile?.id) {
      return { success: false, error: "Kein Brand-Profil vorhanden" };
    }

    try {
      const response = await supabase.functions.invoke("brand-analyze", {
        body: {
          projectId: currentProject.id,
          brandProfileId: brandProfile.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data.success && response.data.error) {
        throw new Error(response.data.error);
      }

      // Refresh profile to get analysis results
      await loadProfile();

      return { success: true };
    } catch (err) {
      console.error("Error triggering analysis:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Analyse fehlgeschlagen",
      };
    }
  }, [currentProject?.id, brandProfile?.id, loadProfile]);

  // Update profile manually
  const updateProfile = useCallback(
    async (updates: Partial<BrandProfile>): Promise<{ success: boolean; error?: string }> => {
      if (!brandProfile?.id) {
        return { success: false, error: "Kein Brand-Profil vorhanden" };
      }

      try {
        // Convert to database format
        const dbUpdates: Record<string, unknown> = {};

        if (updates.brand_name !== undefined) dbUpdates.brand_name = updates.brand_name;
        if (updates.tagline !== undefined) dbUpdates.tagline = updates.tagline;
        if (updates.mission_statement !== undefined) dbUpdates.mission_statement = updates.mission_statement;
        if (updates.brand_story !== undefined) dbUpdates.brand_story = updates.brand_story;
        if (updates.brand_voice !== undefined) dbUpdates.brand_voice = updates.brand_voice;
        if (updates.products !== undefined) dbUpdates.products = updates.products;
        if (updates.services !== undefined) dbUpdates.services = updates.services;
        if (updates.personas !== undefined) dbUpdates.personas = updates.personas;
        if (updates.brand_keywords !== undefined) dbUpdates.brand_keywords = updates.brand_keywords;
        if (updates.competitors !== undefined) dbUpdates.competitors = updates.competitors;
        if (updates.visual_identity !== undefined) dbUpdates.visual_identity = updates.visual_identity;
        if (updates.current_projects !== undefined) dbUpdates.current_projects = updates.current_projects;

        dbUpdates.updated_at = new Date().toISOString();

        const { error: updateError } = await supabase
          .from("brand_profiles")
          .update(dbUpdates)
          .eq("id", brandProfile.id);

        if (updateError) {
          throw updateError;
        }

        // Refresh profile
        await loadProfile();

        return { success: true };
      } catch (err) {
        console.error("Error updating brand profile:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Aktualisierung fehlgeschlagen",
        };
      }
    },
    [brandProfile?.id, loadProfile]
  );

  // Sync to OpenAI Vector Store
  const syncVectorStore = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!currentProject?.id || !brandProfile?.id) {
      return { success: false, error: "Kein Brand-Profil vorhanden" };
    }

    try {
      const response = await supabase.functions.invoke("brand-vector-store", {
        body: {
          projectId: currentProject.id,
          brandProfileId: brandProfile.id,
          action: "sync",
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data.success && response.data.error) {
        throw new Error(response.data.error);
      }

      // Refresh profile to get vector store ID
      await loadProfile();

      return { success: true };
    } catch (err) {
      console.error("Error syncing vector store:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Vector Store Sync fehlgeschlagen",
      };
    }
  }, [currentProject?.id, brandProfile?.id, loadProfile]);

  // Reset brand profile completely
  const resetProfile = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!brandProfile?.id) {
      return { success: false, error: "Kein Brand-Profil vorhanden" };
    }

    try {
      // Delete all crawl data
      await supabase
        .from("brand_crawl_data")
        .delete()
        .eq("brand_profile_id", brandProfile.id);

      // Delete vector documents
      await supabase
        .from("brand_vector_documents")
        .delete()
        .eq("brand_profile_id", brandProfile.id);

      // Reset brand profile to initial state
      const { error: updateError } = await supabase
        .from("brand_profiles")
        .update({
          brand_name: null,
          tagline: null,
          mission_statement: null,
          brand_story: null,
          brand_voice: { tone: [], personality_traits: [], writing_style: {} },
          products: [],
          services: [],
          personas: [],
          brand_keywords: { primary: [], secondary: [], long_tail: [] },
          competitors: [],
          visual_identity: {},
          internal_links: [],
          openai_vector_store_id: null,
          crawl_status: "pending",
          crawl_error: null,
          last_crawl_at: null,
          last_analysis_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", brandProfile.id);

      if (updateError) {
        throw updateError;
      }

      // Refresh profile
      await loadProfile();

      return { success: true };
    } catch (err) {
      console.error("Error resetting brand profile:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Reset fehlgeschlagen",
      };
    }
  }, [brandProfile?.id, loadProfile]);

  // Auto-load profile when project changes
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Poll for status updates when crawling/analyzing
  useEffect(() => {
    if (
      brandProfile?.crawl_status === "crawling" ||
      brandProfile?.crawl_status === "analyzing"
    ) {
      const interval = setInterval(() => {
        loadProfile();
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [brandProfile?.crawl_status, loadProfile]);

  return {
    brandProfile,
    loading,
    error,
    crawlStatus: (brandProfile?.crawl_status as CrawlStatus) || "pending",
    triggerCrawl,
    triggerAnalysis,
    updateProfile,
    syncVectorStore,
    resetProfile,
    refreshProfile: loadProfile,
  };
}
