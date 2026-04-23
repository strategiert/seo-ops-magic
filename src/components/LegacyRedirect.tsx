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
}

export function LegacyRedirect({ suffix = "", passId = false }: LegacyRedirectProps) {
  const { id } = useParams<{ id?: string }>();
  const { currentProject } = useWorkspaceConvex();

  if (!currentProject) {
    return <Navigate to="/projects" replace />;
  }

  const tail = [suffix, passId && id ? id : ""].filter(Boolean).join("/");
  const target = tail
    ? `/projects/${currentProject._id}/${tail}`
    : `/projects/${currentProject._id}`;

  return <Navigate to={target} replace />;
}
