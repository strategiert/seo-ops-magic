import { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CenteredSkeleton } from "./PageSkeleton";

export interface DataStateWrapperProps<T> {
  /** Whether data is currently loading */
  isLoading: boolean;
  /** The data array (undefined/null means not loaded yet, empty array means no data) */
  data: T[] | undefined | null;
  /** Optional error state */
  error?: Error | string | null;
  /** Custom skeleton to show during loading (defaults to CenteredSkeleton) */
  skeleton?: ReactNode;
  /** Empty state component to show when data is empty */
  emptyState: ReactNode;
  /** Render function for when data is available */
  children: (data: T[]) => ReactNode;
  /** Optional retry function for error state */
  onRetry?: () => void;
}

/**
 * DataStateWrapper - Enforces correct loading/empty/error state handling pattern.
 *
 * Logic flow:
 * 1. isLoading → Show skeleton (not spinner!)
 * 2. error → Show error state with optional retry
 * 3. !data || data.length === 0 → Show emptyState
 * 4. data available → Render children(data)
 *
 * @example
 * <DataStateWrapper
 *   isLoading={loading}
 *   data={articles}
 *   skeleton={<TableSkeleton />}
 *   emptyState={
 *     <EmptyState
 *       icon={FileText}
 *       title="Keine Artikel vorhanden"
 *       description="Artikel werden aus Content Briefs generiert."
 *       action={{ label: "Brief erstellen", onClick: () => navigate("/briefs") }}
 *     />
 *   }
 * >
 *   {(articles) => <ArticlesTable data={articles} />}
 * </DataStateWrapper>
 */
export function DataStateWrapper<T>({
  isLoading,
  data,
  error,
  skeleton,
  emptyState,
  children,
  onRetry,
}: DataStateWrapperProps<T>) {
  // 1. Loading state - show skeleton
  if (isLoading) {
    return <>{skeleton || <CenteredSkeleton />}</>;
  }

  // 2. Error state
  if (error) {
    const errorMessage = error instanceof Error ? error.message : error;
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 border rounded-lg border-destructive/20 bg-destructive/5">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium text-destructive">
          Fehler beim Laden
        </h3>
        <p className="text-muted-foreground mt-1 mb-4 max-w-md">
          {errorMessage || "Ein unerwarteter Fehler ist aufgetreten."}
        </p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Erneut versuchen
          </Button>
        )}
      </div>
    );
  }

  // 3. Empty state - no data or empty array
  if (!data || data.length === 0) {
    return <>{emptyState}</>;
  }

  // 4. Data available - render children
  return <>{children(data)}</>;
}
