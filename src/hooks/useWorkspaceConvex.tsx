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
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

/**
 * Pull the current projectId out of the URL if we're on a project-scoped
 * route like /projects/:projectId/... — so the WorkspaceProvider stays in
 * sync with the router without every page having to pass it explicitly.
 */
function useProjectIdFromUrl(): Id<"projects"> | null {
  const { pathname } = useLocation();
  const match = pathname.match(/^\/projects\/([a-zA-Z0-9_]+)/);
  return (match?.[1] ?? null) as Id<"projects"> | null;
}

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
  const navigate = useNavigate();
  const urlProjectId = useProjectIdFromUrl();

  // Track if we're creating the default workspace to prevent duplicates
  const [isCreatingDefaultWorkspace, setIsCreatingDefaultWorkspace] = useState(false);

  // State
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<
    Id<"workspaces"> | null
  >(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.workspaceId);
    return stored ? (stored as Id<"workspaces">) : null;
  });

  // Project selection: the URL is the source of truth when on a project-scoped
  // route; fall back to localStorage when we're on a global page so the user's
  // last project is still available to "Return to project" UI elements.
  const [lastKnownProjectId, setLastKnownProjectId] = useState<
    Id<"projects"> | null
  >(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.projectId);
    return stored ? (stored as Id<"projects">) : null;
  });

  const currentProjectId = urlProjectId ?? lastKnownProjectId;

  // Keep lastKnownProjectId synced with the URL whenever the URL has one
  useEffect(() => {
    if (urlProjectId && urlProjectId !== lastKnownProjectId) {
      setLastKnownProjectId(urlProjectId);
    }
  }, [urlProjectId, lastKnownProjectId]);

  // Convex queries - only run if Clerk is signed in
  // Skip queries if not authenticated to avoid server errors
  const workspacesQuery = useQuery(
    api.tables.workspaces.list,
    clerkLoaded && isSignedIn ? {} : "skip"
  );
  // Track if workspaces query has loaded (undefined = loading, array = loaded)
  const workspacesLoaded = workspacesQuery !== undefined;
  const workspaces = workspacesQuery ?? [];

  const projectsQuery = useQuery(
    api.tables.projects.listByWorkspace,
    clerkLoaded && isSignedIn && currentWorkspaceId
      ? { workspaceId: currentWorkspaceId }
      : "skip"
  );
  const projects = projectsQuery ?? [];

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

  // Auto-create default workspace for new users
  useEffect(() => {
    const createDefaultWorkspace = async () => {
      // Only create if:
      // 1. User is signed in
      // 2. Workspaces query has loaded (workspacesLoaded = true)
      // 3. No workspaces exist
      // 4. Not already creating
      if (
        clerkLoaded &&
        isSignedIn &&
        workspacesLoaded &&
        workspaces.length === 0 &&
        !isCreatingDefaultWorkspace
      ) {
        setIsCreatingDefaultWorkspace(true);
        try {
          console.log("Creating default workspace for new user...");
          const id = await createWorkspaceMutation({ name: "Mein Workspace" });
          setCurrentWorkspaceId(id);
          console.log("Default workspace created:", id);
        } catch (error) {
          console.error("Failed to create default workspace:", error);
        } finally {
          setIsCreatingDefaultWorkspace(false);
        }
      }
    };

    createDefaultWorkspace();
  }, [clerkLoaded, isSignedIn, workspacesLoaded, workspaces.length, isCreatingDefaultWorkspace, createWorkspaceMutation]);

  // Auto-select first project if none selected (only for the localStorage
  // fallback — URL selection is the source of truth on project pages)
  useEffect(() => {
    if (!currentProjectId && projects.length > 0) {
      setLastKnownProjectId(projects[0]._id);
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
    setLastKnownProjectId(null);
    localStorage.removeItem(STORAGE_KEYS.projectId);
  }, []);

  // Selecting a project navigates to its project-scoped dashboard so the URL
  // is always the authoritative source of truth.
  const setCurrentProject = useCallback(
    (project: Project | null) => {
      if (project) {
        setLastKnownProjectId(project._id);
        navigate(`/projects/${project._id}`);
      } else {
        setLastKnownProjectId(null);
      }
    },
    [navigate]
  );

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
      setLastKnownProjectId(id);
      navigate(`/projects/${id}`);
      return id;
    },
    [createProjectMutation, currentWorkspaceId, navigate]
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
    isLoading: !clerkLoaded || (isSignedIn && !workspacesLoaded) || isCreatingDefaultWorkspace,
    isLoadingProjects: !clerkLoaded || (isSignedIn && currentWorkspaceId && projectsQuery === undefined),
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
