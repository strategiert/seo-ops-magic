import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useWorkspaceConvex } from "./useWorkspaceConvex";

/**
 * Convex-based Project Integrations Hook
 *
 * Replaces the Supabase-based useProjectIntegrations hook.
 * Handles NeuronWriter and WordPress integrations.
 */

export interface NeuronWriterIntegration {
  id: string;
  isConnected: boolean;
  nwApiKey: string | null;
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
  refetch: () => void;
}

export function useProjectIntegrations(): ProjectIntegrations {
  const { currentProject } = useWorkspaceConvex();

  // Query integrations from Convex
  const integrations = useQuery(
    api.tables.integrations.listByProject,
    currentProject?._id ? { projectId: currentProject._id } : "skip"
  );

  // Process integrations
  let neuronwriter: NeuronWriterIntegration | null = null;
  let wordpress: WordPressIntegration | null = null;

  if (integrations) {
    const nwInt = integrations.find((i) => i.type === "neuronwriter");
    const wpInt = integrations.find((i) => i.type === "wordpress");

    if (nwInt) {
      neuronwriter = {
        id: nwInt._id,
        isConnected: nwInt.isConnected ?? false,
        nwApiKey: nwInt.credentialsEncrypted ?? null,
        nwProjectId: nwInt.nwProjectId ?? null,
        nwProjectName: nwInt.nwProjectName ?? null,
        nwLanguage: nwInt.nwLanguage ?? "de",
        nwEngine: nwInt.nwEngine ?? "google.de",
        lastSyncAt: nwInt.lastSyncAt ? new Date(nwInt.lastSyncAt).toISOString() : null,
      };
    }

    if (wpInt) {
      wordpress = {
        id: wpInt._id,
        isConnected: wpInt.isConnected ?? false,
        wpUsername: wpInt.wpUsername ?? null,
        wpSiteName: wpInt.wpSiteName ?? null,
        wpIsVerified: wpInt.wpIsVerified ?? false,
      };
    }
  }

  return {
    neuronwriter,
    wordpress,
    loading: integrations === undefined,
    error: null,
    refetch: () => {
      // Convex queries auto-refetch, this is a no-op for API compatibility
    },
  };
}

/**
 * Save NeuronWriter integration settings
 */
export function useSaveNeuronWriterIntegration() {
  const mutation = useMutation(api.tables.integrations.upsertNeuronWriter);

  return async (
    projectId: Id<"projects">,
    config: {
      nwApiKey?: string;
      nwProjectId?: string;
      nwProjectName?: string;
      nwLanguage?: string;
      nwEngine?: string;
    }
  ) => {
    await mutation({
      projectId,
      nwApiKey: config.nwApiKey,
      nwProjectId: config.nwProjectId,
      nwProjectName: config.nwProjectName,
      nwLanguage: config.nwLanguage,
      nwEngine: config.nwEngine,
    });
  };
}

/**
 * Update sync time for an integration
 */
export function useUpdateNeuronWriterSyncTime() {
  const mutation = useMutation(api.tables.integrations.updateSyncTime);

  return async (integrationId: string) => {
    await mutation({ id: integrationId as Id<"integrations"> });
  };
}

// Legacy export for backwards compatibility
export async function saveNeuronWriterIntegration(
  projectId: string,
  config: {
    nwApiKey?: string;
    nwProjectId?: string;
    nwProjectName?: string;
    nwLanguage?: string;
    nwEngine?: string;
  }
): Promise<void> {
  console.warn(
    "saveNeuronWriterIntegration is deprecated. Use useSaveNeuronWriterIntegration hook instead."
  );
  // This function can't work outside React - callers need to use the hook
  throw new Error("saveNeuronWriterIntegration must be called via useSaveNeuronWriterIntegration hook");
}

export async function updateNeuronWriterSyncTime(integrationId: string): Promise<void> {
  console.warn(
    "updateNeuronWriterSyncTime is deprecated. Use useUpdateNeuronWriterSyncTime hook instead."
  );
  throw new Error("updateNeuronWriterSyncTime must be called via useUpdateNeuronWriterSyncTime hook");
}

// Keep WordPress functions for now (unchanged)
export async function saveWordPressIntegration(
  projectId: string,
  config: {
    wpUrl: string;
    wpUsername: string;
    wpAppPassword: string;
    wpSiteName: string;
  }
): Promise<void> {
  console.warn("saveWordPressIntegration needs to be migrated to Convex");
  throw new Error("saveWordPressIntegration must be called via Convex mutation");
}
