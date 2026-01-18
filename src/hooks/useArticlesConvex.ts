import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useWorkspaceConvex } from "./useWorkspaceConvex";

/**
 * Convex-based Articles Hook
 *
 * Provides real-time access to articles with automatic updates.
 */

export interface Article {
  _id: Id<"articles">;
  projectId: Id<"projects">;
  briefId?: Id<"contentBriefs">;
  title: string;
  primaryKeyword?: string;
  contentMarkdown?: string;
  contentHtml?: string;
  metaTitle?: string;
  metaDescription?: string;
  outlineJson?: any;
  faqJson?: any;
  status?: string;
  version?: number;
  wpPostId?: number;
  _creationTime: number;
}

export function useArticlesConvex() {
  const { currentProject } = useWorkspaceConvex();

  // Real-time subscription to articles
  const articles = useQuery(
    api.tables.articles.listByProject,
    currentProject ? { projectId: currentProject._id } : "skip"
  ) as Article[] | undefined;

  // Mutations
  const createArticleMutation = useMutation(api.tables.articles.create);
  const updateArticleMutation = useMutation(api.tables.articles.update);
  const deleteArticleMutation = useMutation(api.tables.articles.remove);

  // Actions
  const generateArticleAction = useAction(api.actions.articleGeneration.generate);
  const generateDesignRecipeAction = useAction(api.actions.gemini.generateDesignRecipe);
  const generateHtmlExportAction = useAction(api.actions.htmlExport.generate);

  /**
   * Get a single article with its design recipe
   */
  const useArticleWithRecipe = (articleId: Id<"articles"> | null) => {
    return useQuery(
      api.tables.articles.getWithRecipe,
      articleId ? { id: articleId } : "skip"
    );
  };

  /**
   * Create a new article
   */
  const createArticle = async (data: {
    title: string;
    primaryKeyword?: string;
    contentMarkdown?: string;
    briefId?: Id<"contentBriefs">;
  }): Promise<Id<"articles">> => {
    if (!currentProject) {
      throw new Error("No project selected");
    }

    return await createArticleMutation({
      projectId: currentProject._id,
      ...data,
    });
  };

  /**
   * Update an article
   */
  const updateArticle = async (
    articleId: Id<"articles">,
    updates: Partial<Article>
  ): Promise<void> => {
    await updateArticleMutation({
      id: articleId,
      ...updates,
    });
  };

  /**
   * Delete an article
   */
  const deleteArticle = async (articleId: Id<"articles">): Promise<void> => {
    await deleteArticleMutation({ id: articleId });
  };

  /**
   * Generate an article from a brief
   */
  const generateFromBrief = async (
    briefId: Id<"contentBriefs">,
    options?: {
      minLocalScore?: number;
      maxRetries?: number;
    }
  ): Promise<{
    success: boolean;
    articleId?: string;
    title?: string;
    wordCount?: number;
    error?: string;
  }> => {
    return await generateArticleAction({
      briefId,
      options,
    });
  };

  /**
   * Generate design recipe for an article
   */
  const generateDesignRecipe = async (
    articleId: Id<"articles">,
    force?: boolean
  ): Promise<{
    success: boolean;
    recipe?: any;
    cached?: boolean;
    error?: string;
  }> => {
    return await generateDesignRecipeAction({
      articleId,
      force,
    });
  };

  /**
   * Generate HTML export for an article
   */
  const generateHtmlExport = async (
    articleId: Id<"articles">,
    format?: "full" | "body-only"
  ): Promise<{
    success: boolean;
    exportId?: string;
    htmlLength?: number;
    error?: string;
  }> => {
    return await generateHtmlExportAction({
      articleId,
      format,
    });
  };

  // Filter helpers
  const draftArticles = articles?.filter((a) => a.status === "draft") ?? [];
  const reviewArticles = articles?.filter((a) => a.status === "review") ?? [];
  const publishedArticles = articles?.filter((a) => a.status === "published") ?? [];

  return {
    // Data
    articles: articles ?? [],
    draftArticles,
    reviewArticles,
    publishedArticles,

    // Loading
    isLoading: articles === undefined,

    // Queries
    useArticleWithRecipe,

    // Mutations
    createArticle,
    updateArticle,
    deleteArticle,

    // Actions
    generateFromBrief,
    generateDesignRecipe,
    generateHtmlExport,
  };
}
