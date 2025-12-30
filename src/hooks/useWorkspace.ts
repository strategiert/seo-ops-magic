import { useState, useEffect } from 'react';
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

export function useWorkspace() {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadWorkspaces();
    }
  }, [user]);

  useEffect(() => {
    if (currentWorkspace) {
      loadProjects(currentWorkspace.id);
    }
  }, [currentWorkspace]);

  const loadWorkspaces = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setWorkspaces(data);
      // Set first workspace as current if none selected
      if (data.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(data[0]);
      }
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
      // Set first project as current if none selected
      if (data.length > 0 && !currentProject) {
        setCurrentProject(data[0]);
      } else if (data.length === 0) {
        setCurrentProject(null);
      }
    }
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
      setProjects([data, ...projects]);
      setCurrentProject(data);
      return data;
    }
    return null;
  };

  const selectProject = (project: Project) => {
    setCurrentProject(project);
  };

  return {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    projects,
    currentProject,
    setCurrentProject: selectProject,
    createProject,
    isLoading,
    reloadProjects: () => currentWorkspace && loadProjects(currentWorkspace.id),
  };
}
