import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

/**
 * Convex-based Workspace Context
 *
 * Replaces the Supabase-based useWorkspace hook with real-time Convex subscriptions.
 * No polling needed - updates are automatic!
 */

interface Workspace {
  _id: Id<"workspaces">;
  name: string;
  ownerId: string;
  _creationTime: number;
}

interface Project {
  _id: Id<"projects">;
  workspaceId: Id<"workspaces">;
  name: string;
  domain?: string;
  wpUrl?: string;
  defaultLanguage?: string;
  defaultCountry?: string;
  defaultTonality?: string;
  defaultTargetAudience?: string;
  defaultDesignPreset?: string;
  _creationTime: number;
}

interface WorkspaceContextType {
  // Workspaces
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (workspace: Workspace | null) => void;

  // Projects
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;

  // Loading states
  isLoading: boolean;
  isLoadingProjects: boolean;

  // Actions
  createWorkspace: (name: string) => Promise<Id<"workspaces">>;
  createProject: (
    name: string,
    domain?: string,
    wpUrl?: string
  ) => Promise<Id<"projects">>;
  updateProject: (
    projectId: Id<"projects">,
    updates: Partial<Project>
  ) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

const STORAGE_KEYS = {
  workspaceId: "seo_content_ops.workspace_id",
  projectId: "seo_content_ops.project_id",
};

export function WorkspaceProviderConvex({ children }: { children: ReactNode }) {
  // Check if Clerk auth is available
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();

  // State
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<
    Id<"workspaces"> | null
  >(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.workspaceId);
    return stored ? (stored as Id<"workspaces">) : null;
  });

  const [currentProjectId, setCurrentProjectId] = useState<
    Id<"projects"> | null
  >(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.projectId);
    return stored ? (stored as Id<"projects">) : null;
  });

  // Convex queries - only run if Clerk is signed in
  // Skip queries if not authenticated to avoid server errors
  const workspaces = useQuery(
    api.tables.workspaces.list,
    clerkLoaded && isSignedIn ? {} : "skip"
  ) ?? [];

  const projects = useQuery(
    api.tables.projects.listByWorkspace,
    clerkLoaded && isSignedIn && currentWorkspaceId
      ? { workspaceId: currentWorkspaceId }
      : "skip"
  ) ?? [];

  // Mutations
  const createWorkspaceMutation = useMutation(api.tables.workspaces.create);
  const createProjectMutation = useMutation(api.tables.projects.create);
  const updateProjectMutation = useMutation(api.tables.projects.update);

  // Derived state
  const currentWorkspace =
    workspaces.find((w) => w._id === currentWorkspaceId) ?? null;
  const currentProject =
    projects.find((p) => p._id === currentProjectId) ?? null;

  // Auto-select first workspace if none selected
  useEffect(() => {
    if (!currentWorkspaceId && workspaces.length > 0) {
      setCurrentWorkspaceId(workspaces[0]._id);
    }
  }, [workspaces, currentWorkspaceId]);

  // Auto-select first project if none selected
  useEffect(() => {
    if (!currentProjectId && projects.length > 0) {
      setCurrentProjectId(projects[0]._id);
    }
  }, [projects, currentProjectId]);

  // Persist selections to localStorage
  useEffect(() => {
    if (currentWorkspaceId) {
      localStorage.setItem(STORAGE_KEYS.workspaceId, currentWorkspaceId);
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    if (currentProjectId) {
      localStorage.setItem(STORAGE_KEYS.projectId, currentProjectId);
    }
  }, [currentProjectId]);

  // Actions
  const setCurrentWorkspace = useCallback((workspace: Workspace | null) => {
    setCurrentWorkspaceId(workspace?._id ?? null);
    // Reset project when workspace changes
    setCurrentProjectId(null);
    localStorage.removeItem(STORAGE_KEYS.projectId);
  }, []);

  const setCurrentProject = useCallback((project: Project | null) => {
    setCurrentProjectId(project?._id ?? null);
  }, []);

  const createWorkspace = useCallback(
    async (name: string): Promise<Id<"workspaces">> => {
      const id = await createWorkspaceMutation({ name });
      setCurrentWorkspaceId(id);
      return id;
    },
    [createWorkspaceMutation]
  );

  const createProject = useCallback(
    async (
      name: string,
      domain?: string,
      wpUrl?: string
    ): Promise<Id<"projects">> => {
      if (!currentWorkspaceId) {
        throw new Error("No workspace selected");
      }

      const id = await createProjectMutation({
        workspaceId: currentWorkspaceId,
        name,
        domain,
        wpUrl,
      });
      setCurrentProjectId(id);
      return id;
    },
    [createProjectMutation, currentWorkspaceId]
  );

  const updateProject = useCallback(
    async (projectId: Id<"projects">, updates: Partial<Project>) => {
      await updateProjectMutation({
        id: projectId,
        ...updates,
      });
    },
    [updateProjectMutation]
  );

  const value: WorkspaceContextType = {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    projects,
    currentProject,
    setCurrentProject,
    isLoading: !clerkLoaded || (isSignedIn && workspaces === undefined),
    isLoadingProjects: !clerkLoaded || (isSignedIn && currentWorkspaceId && projects === undefined),
    createWorkspace,
    createProject,
    updateProject,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceConvex() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error(
      "useWorkspaceConvex must be used within a WorkspaceProviderConvex"
    );
  }
  return context;
}
