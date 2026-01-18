import { useState, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useWorkspaceConvex } from "./useWorkspaceConvex";

/**
 * Convex-based WordPress Hook
 *
 * Replaces the Supabase-based useWordPress hook.
 */

interface Taxonomy {
  id: number;
  name: string;
  slug: string;
}

interface PublishResult {
  success: boolean;
  wpPostId?: number;
  wpUrl?: string;
  status?: string;
  error?: string;
}

export function useWordPressConvex() {
  const { currentProject } = useWorkspaceConvex();

  // Local state
  const [categories, setCategories] = useState<Taxonomy[]>([]);
  const [tags, setTags] = useState<Taxonomy[]>([]);
  const [isLoadingTaxonomies, setIsLoadingTaxonomies] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Actions
  const fetchTaxonomiesAction = useAction(api.actions.wordpress.fetchTaxonomies);
  const publishArticleAction = useAction(api.actions.wordpress.publishArticle);

  /**
   * Fetch WordPress categories and tags
   */
  const fetchTaxonomies = useCallback(async () => {
    if (!currentProject) return;

    setIsLoadingTaxonomies(true);

    try {
      const result = await fetchTaxonomiesAction({
        projectId: currentProject._id,
      });

      if (result.error) {
        console.error("Failed to fetch taxonomies:", result.error);
      } else {
        setCategories(result.categories);
        setTags(result.tags);
      }
    } catch (error) {
      console.error("Error fetching taxonomies:", error);
    } finally {
      setIsLoadingTaxonomies(false);
    }
  }, [currentProject, fetchTaxonomiesAction]);

  /**
   * Publish an article to WordPress
   */
  const publishArticle = useCallback(
    async (
      articleId: Id<"articles">,
      options?: {
        status?: "draft" | "publish";
        categoryIds?: number[];
        tagIds?: number[];
      }
    ): Promise<PublishResult> => {
      setIsPublishing(true);

      try {
        const result = await publishArticleAction({
          articleId,
          status: options?.status,
          categoryIds: options?.categoryIds,
          tagIds: options?.tagIds,
        });

        return result;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Publish failed",
        };
      } finally {
        setIsPublishing(false);
      }
    },
    [publishArticleAction]
  );

  /**
   * Bulk publish multiple articles
   */
  const bulkPublish = useCallback(
    async (
      articleIds: Id<"articles">[],
      options?: {
        status?: "draft" | "publish";
        categoryIds?: number[];
        tagIds?: number[];
      }
    ): Promise<{
      succeeded: Array<{ articleId: Id<"articles">; wpPostId?: number }>;
      failed: Array<{ articleId: Id<"articles">; error: string }>;
    }> => {
      const results = await Promise.allSettled(
        articleIds.map((articleId) => publishArticle(articleId, options))
      );

      const succeeded: Array<{ articleId: Id<"articles">; wpPostId?: number }> = [];
      const failed: Array<{ articleId: Id<"articles">; error: string }> = [];

      results.forEach((result, index) => {
        const articleId = articleIds[index];
        if (result.status === "fulfilled" && result.value.success) {
          succeeded.push({ articleId, wpPostId: result.value.wpPostId });
        } else {
          const error =
            result.status === "rejected"
              ? result.reason?.message || "Unknown error"
              : result.value.error || "Unknown error";
          failed.push({ articleId, error });
        }
      });

      return { succeeded, failed };
    },
    [publishArticle]
  );

  return {
    // Data
    categories,
    tags,

    // Loading states
    isLoadingTaxonomies,
    isPublishing,

    // Actions
    fetchTaxonomies,
    publishArticle,
    bulkPublish,
  };
}
