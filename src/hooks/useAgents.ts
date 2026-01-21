import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useWorkspaceConvex } from "./useWorkspaceConvex";
import { useCallback } from "react";

/**
 * Agents Hook
 *
 * Provides access to AI agents with real-time job status updates.
 * Triggers agents via Inngest events for background processing.
 *
 * Available Agents:
 * - seo-writer: Generate articles from briefs (10 credits)
 * - html-designer: Transform markdown to styled HTML (3 credits)
 * - wp-publisher: Publish articles to WordPress (1 credit)
 * - internal-linker: Suggest internal links (5 credits)
 * - social-creator: Generate social media posts (5 credits)
 * - ad-copy-writer: Generate advertising copy (4 credits)
 * - press-release: Generate press releases (6 credits)
 */

// Agent cost definitions (synced with Convex)
export const AGENT_CREDITS = {
  "seo-writer": 10,
  "html-designer": 3,
  "wp-publisher": 1,
  "internal-linker": 5,
  "social-creator": 5,
  "ad-copy-writer": 4,
  "press-release": 6,
  newsletter: 5,
  "image-generator": 8,
} as const;

export type AgentId = keyof typeof AGENT_CREDITS;

// Job status types
export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface AgentJob {
  _id: Id<"agentJobs">;
  inngestEventId: string;
  userId: string;
  workspaceId: Id<"workspaces">;
  projectId: Id<"projects">;
  agentId: string;
  eventType: string;
  status: JobStatus;
  progress: number;
  currentStep?: string;
  inputData?: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  creditsReserved: number;
  creditsUsed?: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface TriggerResult {
  success: boolean;
  eventId?: string;
  message?: string;
  creditsReserved?: number;
  error?: string;
}

export function useAgents() {
  const { currentWorkspace, currentProject } = useWorkspaceConvex();

  // Real-time subscription to active jobs (queued + running)
  const activeJobs = useQuery(
    api.agents.triggers.getActiveJobs,
    currentWorkspace ? { workspaceId: currentWorkspace._id } : "skip"
  ) as AgentJob[] | undefined;

  // Real-time subscription to job history
  const jobHistory = useQuery(
    api.agents.triggers.getJobHistory,
    currentWorkspace ? { workspaceId: currentWorkspace._id, limit: 20 } : "skip"
  ) as AgentJob[] | undefined;

  // Agent trigger actions
  const triggerArticleGenerationAction = useAction(
    api.agents.triggers.triggerArticleGeneration
  );
  const triggerHtmlTransformationAction = useAction(
    api.agents.triggers.triggerHtmlTransformation
  );
  const triggerWordPressPublishAction = useAction(
    api.agents.triggers.triggerWordPressPublish
  );
  const triggerSocialPostsAction = useAction(
    api.agents.triggers.triggerSocialPosts
  );

  /**
   * Generate an article from a content brief
   * @param briefId - The content brief ID
   * @returns Trigger result with event ID
   */
  const generateArticle = useCallback(
    async (briefId: Id<"contentBriefs">): Promise<TriggerResult> => {
      return await triggerArticleGenerationAction({ briefId });
    },
    [triggerArticleGenerationAction]
  );

  /**
   * Transform article markdown to styled HTML
   * @param articleId - The article ID
   * @returns Trigger result with event ID
   */
  const transformToHtml = useCallback(
    async (articleId: Id<"articles">): Promise<TriggerResult> => {
      return await triggerHtmlTransformationAction({ articleId });
    },
    [triggerHtmlTransformationAction]
  );

  /**
   * Publish article to WordPress
   * @param articleId - The article ID
   * @param status - WordPress post status (draft or publish)
   * @returns Trigger result with event ID
   */
  const publishToWordPress = useCallback(
    async (
      articleId: Id<"articles">,
      status: "draft" | "publish" = "draft"
    ): Promise<TriggerResult> => {
      return await triggerWordPressPublishAction({ articleId, status });
    },
    [triggerWordPressPublishAction]
  );

  /**
   * Generate social media posts from article
   * @param articleId - The article ID
   * @param platforms - Target platforms
   * @returns Trigger result with event ID
   */
  const generateSocialPosts = useCallback(
    async (
      articleId: Id<"articles">,
      platforms: ("linkedin" | "twitter" | "instagram" | "facebook")[]
    ): Promise<TriggerResult> => {
      return await triggerSocialPostsAction({ articleId, platforms });
    },
    [triggerSocialPostsAction]
  );

  /**
   * Get jobs for a specific article
   */
  const useArticleJobs = (articleId: Id<"articles"> | null) => {
    return useQuery(
      api.agents.triggers.getArticleJobs,
      articleId ? { articleId } : "skip"
    ) as AgentJob[] | undefined;
  };

  /**
   * Get a specific job's status
   */
  const useJobStatus = (jobId: Id<"agentJobs"> | null) => {
    return useQuery(
      api.agents.triggers.getJobStatus,
      jobId ? { jobId } : "skip"
    ) as AgentJob | null | undefined;
  };

  // Helper: Check if any job is currently running
  const hasRunningJobs = (activeJobs?.length ?? 0) > 0;

  // Helper: Get running job for a specific article
  const getArticleRunningJob = useCallback(
    (articleId: string): AgentJob | undefined => {
      return activeJobs?.find(
        (job) =>
          job.inputData?.articleId === articleId ||
          job.result?.articleId === articleId
      );
    },
    [activeJobs]
  );

  // Helper: Get running job for a specific brief
  const getBriefRunningJob = useCallback(
    (briefId: string): AgentJob | undefined => {
      return activeJobs?.find((job) => job.inputData?.briefId === briefId);
    },
    [activeJobs]
  );

  // Helper: Count jobs by status
  const jobCounts = {
    queued: activeJobs?.filter((j) => j.status === "queued").length ?? 0,
    running: activeJobs?.filter((j) => j.status === "running").length ?? 0,
    completed:
      jobHistory?.filter((j) => j.status === "completed").length ?? 0,
    failed: jobHistory?.filter((j) => j.status === "failed").length ?? 0,
  };

  return {
    // Data
    activeJobs: activeJobs ?? [],
    jobHistory: jobHistory ?? [],
    hasRunningJobs,
    jobCounts,

    // Loading states
    isLoadingJobs: activeJobs === undefined,
    isLoadingHistory: jobHistory === undefined,

    // Trigger actions
    generateArticle,
    transformToHtml,
    publishToWordPress,
    generateSocialPosts,

    // Query hooks
    useArticleJobs,
    useJobStatus,

    // Helpers
    getArticleRunningJob,
    getBriefRunningJob,

    // Constants
    AGENT_CREDITS,
  };
}
