import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  domain: string | null;
  wp_url: string | null;
  created_at: string;
}

const LS_WORKSPACE_ID = 'seo_content_ops.workspace_id';
const LS_PROJECT_ID = 'seo_content_ops.project_id';

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function useWorkspaceState() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      void loadWorkspaces();
    } else {
      setWorkspaces([]);
      setProjects([]);
      setCurrentWorkspace(null);
      setCurrentProject(null);
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (currentWorkspace) {
      void loadProjects(currentWorkspace.id);
    } else {
      setProjects([]);
      setCurrentProject(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id]);

  const loadWorkspaces = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setWorkspaces(data);

      const storedWsId = safeGet(LS_WORKSPACE_ID);
      const nextWs = (storedWsId && data.find((w) => w.id === storedWsId)) || data[0] || null;
      setCurrentWorkspace(nextWs);
    }

    setIsLoading(false);
  };

  const loadProjects = async (workspaceId: string) => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProjects(data);

      const storedProjectId = safeGet(LS_PROJECT_ID);
      const nextProject =
        (storedProjectId && data.find((p) => p.id === storedProjectId)) || data[0] || null;

      setCurrentProject(nextProject);
    }
  };

  const selectWorkspace = (workspace: Workspace | null) => {
    setCurrentWorkspace(workspace);
    safeSet(LS_WORKSPACE_ID, workspace?.id ?? null);

    // reset project selection when workspace changes
    setCurrentProject(null);
    safeSet(LS_PROJECT_ID, null);
  };

  const createProject = async (name: string, domain?: string, wpUrl?: string) => {
    if (!currentWorkspace) return null;

    const { data, error } = await supabase
      .from('projects')
      .insert({
        workspace_id: currentWorkspace.id,
        name,
        domain: domain || null,
        wp_url: wpUrl || null,
      })
      .select()
      .single();

    if (!error && data) {
      setProjects((prev) => [data, ...prev]);
      setCurrentProject(data);
      safeSet(LS_PROJECT_ID, data.id);
      return data;
    }

    return null;
  };

  const selectProject = (project: Project | null) => {
    setCurrentProject(project);
    safeSet(LS_PROJECT_ID, project?.id ?? null);
  };

  const value = useMemo(
    () => ({
      workspaces,
      currentWorkspace,
      setCurrentWorkspace: selectWorkspace,
      projects,
      currentProject,
      setCurrentProject: selectProject,
      createProject,
      isLoading,
      reloadProjects: () => currentWorkspace && loadProjects(currentWorkspace.id),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workspaces, currentWorkspace, projects, currentProject, isLoading]
  );

  return value;
}

type WorkspaceContextValue = ReturnType<typeof useWorkspaceState>;

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const value = useWorkspaceState();
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return ctx;
}
