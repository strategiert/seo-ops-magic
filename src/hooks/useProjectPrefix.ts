import { useWorkspaceConvex } from "./useWorkspaceConvex";

/**
 * Returns `/projects/<currentProjectId>` for building project-scoped URLs,
 * or an empty string when no project is selected. Use it like:
 *
 *   const prefix = useProjectPrefix();
 *   navigate(`${prefix}/articles/${articleId}`);
 *
 * Centralizes the route shape so a later URL restructure is a single edit.
 */
export function useProjectPrefix(): string {
  const { currentProject } = useWorkspaceConvex();
  return currentProject ? `/projects/${currentProject._id}` : "";
}
