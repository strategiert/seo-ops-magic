import { Navigate, useParams } from "react-router-dom";
import { useWorkspaceConvex } from "@/hooks/useWorkspaceConvex";

/**
 * Back-compat shim for the old flat URLs (/brand, /briefs, /articles/:id,
 * etc.) introduced before the project-scoped URL tree. Redirects to the
 * equivalent /projects/<currentProjectId>/<suffix> URL.
 *
 * If the user has no current project (first login, or project deleted),
 * sends them to /projects so they can pick or create one.
 */
interface LegacyRedirectProps {
  /** Tail of the new URL, e.g. "brand" or "briefs" — will be appended
   *  after /projects/<id>/. Leave empty to redirect to the project
   *  dashboard root. */
  suffix?: string;
  /** If true, the :id URL param is appended to the suffix path
   *  (e.g. /briefs/abc123 → /projects/<pid>/briefs/abc123). */
  passId?: boolean;
  /** URL param to append when passId is true. */
  paramName?: string;
}

export function LegacyRedirect({
  suffix = "",
  passId = false,
  paramName = "id",
}: LegacyRedirectProps) {
  const params = useParams<Record<string, string | undefined>>();
  const {
    workspaces,
    currentWorkspace,
    projects,
    currentProject,
    isLoading,
    isLoadingProjects,
  } = useWorkspaceConvex();

  const targetProject = currentProject ?? projects[0] ?? null;
  const isSelectingWorkspace = workspaces.length > 0 && !currentWorkspace;

  if (isLoading || isLoadingProjects || isSelectingWorkspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!targetProject) {
    return <Navigate to="/projects" replace />;
  }

  const passthroughId = passId ? params[paramName] : "";
  const tail = [suffix, passthroughId].filter(Boolean).join("/");
  const target = tail
    ? `/projects/${targetProject._id}/${tail}`
    : `/projects/${targetProject._id}`;

  return <Navigate to={target} replace />;
}
