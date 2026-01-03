import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";

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
}

export function useWordPress(): UseWordPressReturn {
  const { currentProject } = useWorkspace();
  const [taxonomies, setTaxonomies] = useState<WordPressTaxonomies | null>(null);
  const [loadingTaxonomies, setLoadingTaxonomies] = useState(false);
  const [taxonomiesError, setTaxonomiesError] = useState<string | null>(null);
  const [publishingArticleId, setPublishingArticleId] = useState<string | null>(null);

  const fetchTaxonomies = useCallback(async () => {
    if (!currentProject?.id) {
      setTaxonomies(null);
      return;
    }

    setLoadingTaxonomies(true);
    setTaxonomiesError(null);

    try {
      const response = await supabase.functions.invoke("wordpress-taxonomies", {
        body: { projectId: currentProject.id },
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
  }, [currentProject?.id]);

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
    if (currentProject?.id) {
      fetchTaxonomies();
    }
  }, [currentProject?.id, fetchTaxonomies]);

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

      for (const articleId of articleIds) {
        try {
          const response = await supabase.functions.invoke("wordpress-publish", {
            body: {
              articleId,
              status: options.status || "draft",
              categoryIds: options.categoryIds || [],
              tagIds: options.tagIds || [],
            },
          });

          if (response.error) {
            newResults.set(articleId, {
              success: false,
              error: response.error.message,
            });
          } else if (!response.data.success) {
            newResults.set(articleId, {
              success: false,
              error: response.data.error || "Publishing failed",
            });
          } else {
            newResults.set(articleId, {
              success: true,
              wpPostId: response.data.wpPostId,
              wpUrl: response.data.wpUrl,
            });
          }
        } catch (error) {
          newResults.set(articleId, {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

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
