import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { useWorkspaceConvex } from "./useWorkspaceConvex";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export interface TaxonomyItem {
  id: number;
  name: string;
  slug: string;
  count?: number;
  parent?: number;
}

export interface WordPressTaxonomies {
  categories: TaxonomyItem[];
  tags: TaxonomyItem[];
}

export interface PublishResult {
  success: boolean;
  wpPostId?: number;
  wpUrl?: string;
  error?: string;
}

export interface UseWordPressReturn {
  taxonomies: WordPressTaxonomies | null;
  loadingTaxonomies: boolean;
  taxonomiesError: string | null;
  fetchTaxonomies: () => Promise<void>;
  publishArticle: (articleId: string, options?: PublishOptions) => Promise<PublishResult>;
  publishingArticleId: string | null;
}

export interface PublishOptions {
  status?: "publish" | "draft";
  categoryIds?: number[];
  tagIds?: number[];
  useStyledHtml?: boolean;
}

export function useWordPress(): UseWordPressReturn {
  const { currentProject } = useWorkspaceConvex();
  const [taxonomies, setTaxonomies] = useState<WordPressTaxonomies | null>(null);
  const [loadingTaxonomies, setLoadingTaxonomies] = useState(false);
  const [taxonomiesError, setTaxonomiesError] = useState<string | null>(null);
  const [publishingArticleId, setPublishingArticleId] = useState<string | null>(null);

  // Convex actions
  const fetchTaxonomiesAction = useAction(api.actions.wordpress.fetchTaxonomies);
  const publishArticleAction = useAction(api.actions.wordpress.publishArticle);

  const fetchTaxonomies = useCallback(async () => {
    if (!currentProject?._id) {
      setTaxonomies(null);
      return;
    }

    setLoadingTaxonomies(true);
    setTaxonomiesError(null);

    try {
      const result = await fetchTaxonomiesAction({
        projectId: currentProject._id,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setTaxonomies({
        categories: result.categories || [],
        tags: result.tags || [],
      });
    } catch (error) {
      console.error("Error fetching taxonomies:", error);
      setTaxonomiesError(
        error instanceof Error ? error.message : "Fehler beim Laden der Kategorien"
      );
      setTaxonomies(null);
    } finally {
      setLoadingTaxonomies(false);
    }
  }, [currentProject?._id, fetchTaxonomiesAction]);

  const publishArticle = useCallback(
    async (articleId: string, options: PublishOptions = {}): Promise<PublishResult> => {
      setPublishingArticleId(articleId);

      try {
        const result = await publishArticleAction({
          articleId: articleId as Id<"articles">,
          status: options.status || "draft",
          categoryIds: options.categoryIds || [],
          tagIds: options.tagIds || [],
        });

        if (!result.success) {
          throw new Error(result.error || "Publishing failed");
        }

        return {
          success: true,
          wpPostId: result.wpPostId,
          wpUrl: result.wpUrl,
        };
      } catch (error) {
        console.error("Error publishing article:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Fehler beim Veröffentlichen",
        };
      } finally {
        setPublishingArticleId(null);
      }
    },
    [publishArticleAction]
  );

  // Auto-fetch taxonomies when project changes
  useEffect(() => {
    if (currentProject?._id) {
      fetchTaxonomies();
    }
  }, [currentProject?._id, fetchTaxonomies]);

  return {
    taxonomies,
    loadingTaxonomies,
    taxonomiesError,
    fetchTaxonomies,
    publishArticle,
    publishingArticleId,
  };
}

// Bulk publish hook
export function useWordPressBulkPublish() {
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<Map<string, PublishResult>>(new Map());

  // Convex action
  const publishArticleAction = useAction(api.actions.wordpress.publishArticle);

  const publishMultiple = useCallback(
    async (
      articleIds: string[],
      options: PublishOptions = {}
    ): Promise<Map<string, PublishResult>> => {
      setPublishing(true);
      const newResults = new Map<string, PublishResult>();

      // Publish all articles in parallel using Promise.allSettled for better error handling
      const publishPromises = articleIds.map(async (articleId) => {
        try {
          const result = await publishArticleAction({
            articleId: articleId as Id<"articles">,
            status: options.status || "draft",
            categoryIds: options.categoryIds || [],
            tagIds: options.tagIds || [],
          });

          if (!result.success) {
            return {
              articleId,
              result: {
                success: false,
                error: result.error || "Publishing failed",
              } as PublishResult,
            };
          }

          return {
            articleId,
            result: {
              success: true,
              wpPostId: result.wpPostId,
              wpUrl: result.wpUrl,
            } as PublishResult,
          };
        } catch (error) {
          return {
            articleId,
            result: {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            } as PublishResult,
          };
        }
      });

      // Wait for all promises to settle (either resolve or reject)
      const settledResults = await Promise.allSettled(publishPromises);

      // Process results
      settledResults.forEach((settled, index) => {
        const articleId = articleIds[index];
        if (settled.status === "fulfilled") {
          newResults.set(settled.value.articleId, settled.value.result);
        } else {
          // If the promise itself was rejected (shouldn't happen with our try/catch, but just in case)
          newResults.set(articleId, {
            success: false,
            error: "Unexpected error during publishing",
          });
        }
      });

      setResults(newResults);
      setPublishing(false);
      return newResults;
    },
    [publishArticleAction]
  );

  return {
    publishing,
    results,
    publishMultiple,
  };
}
