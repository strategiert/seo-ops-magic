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

export interface ProjectIntegrations {
  neuronwriter: NeuronWriterIntegration | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProjectIntegrations(): ProjectIntegrations {
  const { currentProject } = useWorkspace();
  const [neuronwriter, setNeuronwriter] = useState<NeuronWriterIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!currentProject?.id) {
      setNeuronwriter(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("integrations")
        .select("*")
        .eq("project_id", currentProject.id)
        .eq("type", "neuronwriter")
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setNeuronwriter({
          id: data.id,
          isConnected: data.is_connected ?? false,
          nwProjectId: data.nw_project_id,
          nwProjectName: data.nw_project_name,
          nwLanguage: data.nw_language ?? "de",
          nwEngine: data.nw_engine ?? "google.de",
          lastSyncAt: data.last_sync_at,
        });
      } else {
        setNeuronwriter(null);
      }
    } catch (err) {
      console.error("Error fetching integrations:", err);
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Integrationen");
      setNeuronwriter(null);
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  return {
    neuronwriter,
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
