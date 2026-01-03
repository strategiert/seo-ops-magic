import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";

export interface NeuronWriterIntegration {
  id: string;
  isConnected: boolean;
  nwProjectId: string | null;
  nwProjectName: string | null;
  nwLanguage: string;
  nwEngine: string;
  lastSyncAt: string | null;
}

export interface WordPressIntegration {
  id: string;
  isConnected: boolean;
  wpUsername: string | null;
  wpSiteName: string | null;
  wpIsVerified: boolean;
}

export interface ProjectIntegrations {
  neuronwriter: NeuronWriterIntegration | null;
  wordpress: WordPressIntegration | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProjectIntegrations(): ProjectIntegrations {
  const { currentProject } = useWorkspace();
  const [neuronwriter, setNeuronwriter] = useState<NeuronWriterIntegration | null>(null);
  const [wordpress, setWordpress] = useState<WordPressIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!currentProject?.id) {
      setNeuronwriter(null);
      setWordpress(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all integrations for this project
      const { data, error: fetchError } = await supabase
        .from("integrations")
        .select("*")
        .eq("project_id", currentProject.id);

      if (fetchError) throw fetchError;

      // Process NeuronWriter integration
      const nwData = data?.find((i) => i.type === "neuronwriter");
      if (nwData) {
        setNeuronwriter({
          id: nwData.id,
          isConnected: nwData.is_connected ?? false,
          nwProjectId: nwData.nw_project_id,
          nwProjectName: nwData.nw_project_name,
          nwLanguage: nwData.nw_language ?? "de",
          nwEngine: nwData.nw_engine ?? "google.de",
          lastSyncAt: nwData.last_sync_at,
        });
      } else {
        setNeuronwriter(null);
      }

      // Process WordPress integration
      const wpData = data?.find((i) => i.type === "wordpress");
      if (wpData) {
        setWordpress({
          id: wpData.id,
          isConnected: wpData.is_connected ?? false,
          wpUsername: (wpData as any).wp_username ?? null,
          wpSiteName: (wpData as any).wp_site_name ?? null,
          wpIsVerified: (wpData as any).wp_is_verified ?? false,
        });
      } else {
        setWordpress(null);
      }
    } catch (err) {
      console.error("Error fetching integrations:", err);
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Integrationen");
      setNeuronwriter(null);
      setWordpress(null);
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  return {
    neuronwriter,
    wordpress,
    loading,
    error,
    refetch: fetchIntegrations,
  };
}

export async function saveNeuronWriterIntegration(
  projectId: string,
  config: {
    nwProjectId: string;
    nwProjectName: string;
    nwLanguage: string;
    nwEngine: string;
  }
): Promise<void> {
  // Check if integration already exists
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("project_id", projectId)
    .eq("type", "neuronwriter")
    .maybeSingle();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("integrations")
      .update({
        nw_project_id: config.nwProjectId,
        nw_project_name: config.nwProjectName,
        nw_language: config.nwLanguage,
        nw_engine: config.nwEngine,
        is_connected: true,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    // Insert new
    const { error } = await supabase
      .from("integrations")
      .insert({
        project_id: projectId,
        type: "neuronwriter",
        nw_project_id: config.nwProjectId,
        nw_project_name: config.nwProjectName,
        nw_language: config.nwLanguage,
        nw_engine: config.nwEngine,
        is_connected: true,
        last_sync_at: new Date().toISOString(),
      });

    if (error) throw error;
  }
}

export async function updateNeuronWriterSyncTime(integrationId: string): Promise<void> {
  const { error } = await supabase
    .from("integrations")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", integrationId);

  if (error) throw error;
}

export async function saveWordPressIntegration(
  projectId: string,
  config: {
    wpUrl: string;
    wpUsername: string;
    wpAppPassword: string;
    wpSiteName: string;
  }
): Promise<void> {
  // First, update the project's wp_url
  const { error: projectError } = await supabase
    .from("projects")
    .update({ wp_url: config.wpUrl })
    .eq("id", projectId);

  if (projectError) throw projectError;

  // Check if integration already exists
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("project_id", projectId)
    .eq("type", "wordpress")
    .maybeSingle();

  const integrationData = {
    wp_username: config.wpUsername,
    wp_app_password: config.wpAppPassword,
    wp_site_name: config.wpSiteName,
    wp_is_verified: true,
    is_connected: true,
  };

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("integrations")
      .update(integrationData)
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    // Insert new
    const { error } = await supabase
      .from("integrations")
      .insert({
        project_id: projectId,
        type: "wordpress",
        ...integrationData,
      });

    if (error) throw error;
  }
}
