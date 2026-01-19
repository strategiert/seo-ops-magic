import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceConvex } from "./useWorkspaceConvex";

export interface TaxonomyItem {
  id: number;
  name: string;
  slug: string;
  count: number;
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

  const fetchTaxonomies = useCallback(async () => {
    if (!currentProject?._id) {
      setTaxonomies(null);
      return;
    }

    setLoadingTaxonomies(true);
    setTaxonomiesError(null);

    try {
      const response = await supabase.functions.invoke("wordpress-taxonomies", {
        body: { projectId: currentProject._id },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setTaxonomies({
        categories: response.data.categories || [],
        tags: response.data.tags || [],
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
  }, [currentProject?._id]);

  const publishArticle = useCallback(
    async (articleId: string, options: PublishOptions = {}): Promise<PublishResult> => {
      setPublishingArticleId(articleId);

      try {
        const response = await supabase.functions.invoke("wordpress-publish", {
          body: {
            articleId,
            status: options.status || "draft",
            categoryIds: options.categoryIds || [],
            tagIds: options.tagIds || [],
            useStyledHtml: options.useStyledHtml !== false, // Default to true
          },
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        if (!response.data.success) {
          throw new Error(response.data.error || "Publishing failed");
        }

        return {
          success: true,
          wpPostId: response.data.wpPostId,
          wpUrl: response.data.wpUrl,
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
    []
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
          const response = await supabase.functions.invoke("wordpress-publish", {
            body: {
              articleId,
              status: options.status || "draft",
              categoryIds: options.categoryIds || [],
              tagIds: options.tagIds || [],
              useStyledHtml: options.useStyledHtml !== false, // Default to true
            },
          });

          if (response.error) {
            return {
              articleId,
              result: {
                success: false,
                error: response.error.message,
              } as PublishResult,
            };
          } else if (!response.data.success) {
            return {
              articleId,
              result: {
                success: false,
                error: response.data.error || "Publishing failed",
              } as PublishResult,
            };
          } else {
            return {
              articleId,
              result: {
                success: true,
                wpPostId: response.data.wpPostId,
                wpUrl: response.data.wpUrl,
              } as PublishResult,
            };
          }
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
    []
  );

  return {
    publishing,
    results,
    publishMultiple,
  };
}
