// supabase/functions/_shared/job-tracker.ts
// Job Tracker - Progress tracking for long-running operations

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { JobType, JobStatus, JobConfig } from "./brand-research-types.ts";

// ============================================================================
// JOB TRACKER CLASS
// ============================================================================

export class JobTracker {
  private supabase: SupabaseClient;
  private jobId: string;
  private stepsTotal: number;
  private stepsCompleted: number;

  constructor(supabase: SupabaseClient, jobId: string, stepsTotal: number = 1) {
    this.supabase = supabase;
    this.jobId = jobId;
    this.stepsTotal = stepsTotal;
    this.stepsCompleted = 0;
  }

  /**
   * Creates a new job and returns a tracker instance
   */
  static async create(
    supabase: SupabaseClient,
    brandProfileId: string,
    jobType: JobType,
    config: JobConfig = {},
    stepsTotal: number = 1
  ): Promise<JobTracker> {
    const { data, error } = await supabase
      .from("brand_research_jobs")
      .insert({
        brand_profile_id: brandProfileId,
        job_type: jobType,
        config,
        status: "pending",
        progress: 0,
        steps_total: stepsTotal,
        steps_completed: 0,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[JobTracker] Failed to create job:", error);
      throw new Error(`Failed to create job: ${error.message}`);
    }

    console.log(`[JobTracker] Created job ${data.id} (type: ${jobType})`);
    return new JobTracker(supabase, data.id, stepsTotal);
  }

  /**
   * Loads an existing job tracker
   */
  static async load(supabase: SupabaseClient, jobId: string): Promise<JobTracker | null> {
    const { data, error } = await supabase
      .from("brand_research_jobs")
      .select("id, steps_total, steps_completed")
      .eq("id", jobId)
      .single();

    if (error || !data) {
      console.error("[JobTracker] Failed to load job:", error);
      return null;
    }

    const tracker = new JobTracker(supabase, data.id, data.steps_total);
    tracker.stepsCompleted = data.steps_completed;
    return tracker;
  }

  /**
   * Gets the job ID
   */
  getJobId(): string {
    return this.jobId;
  }

  /**
   * Starts the job
   */
  async start(currentStep?: string): Promise<void> {
    await this.update({
      status: "running",
      started_at: new Date().toISOString(),
      current_step: currentStep || "Starting...",
      progress: 0,
    });
    console.log(`[JobTracker] Job ${this.jobId} started`);
  }

  /**
   * Updates progress with a step description
   */
  async updateProgress(step: string, progress?: number): Promise<void> {
    const calculatedProgress = progress ?? Math.round((this.stepsCompleted / this.stepsTotal) * 100);

    await this.update({
      current_step: step,
      progress: Math.min(calculatedProgress, 99), // Never show 100% until complete
    });

    console.log(`[JobTracker] ${this.jobId}: ${step} (${calculatedProgress}%)`);
  }

  /**
   * Completes a step and moves to the next
   */
  async completeStep(nextStep?: string): Promise<void> {
    this.stepsCompleted++;
    const progress = Math.round((this.stepsCompleted / this.stepsTotal) * 100);

    await this.update({
      steps_completed: this.stepsCompleted,
      progress: Math.min(progress, 99),
      current_step: nextStep,
    });

    console.log(`[JobTracker] ${this.jobId}: Step ${this.stepsCompleted}/${this.stepsTotal} completed`);
  }

  /**
   * Marks the job as completed with results
   */
  async complete(result?: unknown): Promise<void> {
    await this.update({
      status: "completed",
      progress: 100,
      steps_completed: this.stepsTotal,
      current_step: "Completed",
      result: result ? JSON.stringify(result) : null,
      completed_at: new Date().toISOString(),
    });

    console.log(`[JobTracker] Job ${this.jobId} completed successfully`);
  }

  /**
   * Marks the job as failed with an error message
   */
  async fail(error: string | Error): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;

    await this.update({
      status: "failed",
      error_message: errorMessage,
      current_step: "Failed",
      completed_at: new Date().toISOString(),
    });

    console.error(`[JobTracker] Job ${this.jobId} failed: ${errorMessage}`);
  }

  /**
   * Cancels the job
   */
  async cancel(reason?: string): Promise<void> {
    await this.update({
      status: "cancelled",
      error_message: reason || "Cancelled by user",
      current_step: "Cancelled",
      completed_at: new Date().toISOString(),
    });

    console.log(`[JobTracker] Job ${this.jobId} cancelled`);
  }

  /**
   * Gets the current job status
   */
  async getStatus(): Promise<{
    status: JobStatus;
    progress: number;
    currentStep?: string;
    result?: unknown;
    error?: string;
  } | null> {
    const { data, error } = await this.supabase
      .from("brand_research_jobs")
      .select("status, progress, current_step, result, error_message")
      .eq("id", this.jobId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      status: data.status as JobStatus,
      progress: data.progress,
      currentStep: data.current_step,
      result: data.result,
      error: data.error_message,
    };
  }

  /**
   * Private helper to update job fields
   */
  private async update(fields: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase
      .from("brand_research_jobs")
      .update({
        ...fields,
        updated_at: new Date().toISOString(),
      })
      .eq("id", this.jobId);

    if (error) {
      console.error("[JobTracker] Failed to update job:", error);
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets job status by ID (for status endpoint)
 */
export async function getJobStatus(
  supabase: SupabaseClient,
  jobId: string
): Promise<{
  jobId: string;
  status: JobStatus;
  progress: number;
  currentStep?: string;
  stepsCompleted: number;
  stepsTotal: number;
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
} | null> {
  const { data, error } = await supabase
    .from("brand_research_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    jobId: data.id,
    status: data.status,
    progress: data.progress,
    currentStep: data.current_step,
    stepsCompleted: data.steps_completed,
    stepsTotal: data.steps_total,
    result: data.result,
    error: data.error_message,
    startedAt: data.started_at,
    completedAt: data.completed_at,
  };
}

/**
 * Lists recent jobs for a brand profile
 */
export async function listJobs(
  supabase: SupabaseClient,
  brandProfileId: string,
  options: {
    limit?: number;
    status?: JobStatus;
    jobType?: JobType;
  } = {}
): Promise<Array<{
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  progress: number;
  createdAt: string;
}>> {
  let query = supabase
    .from("brand_research_jobs")
    .select("id, job_type, status, progress, created_at")
    .eq("brand_profile_id", brandProfileId)
    .order("created_at", { ascending: false });

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.jobType) {
    query = query.eq("job_type", options.jobType);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((job) => ({
    jobId: job.id,
    jobType: job.job_type as JobType,
    status: job.status as JobStatus,
    progress: job.progress,
    createdAt: job.created_at,
  }));
}

/**
 * Cleans up old completed/failed jobs
 */
export async function cleanupOldJobs(
  supabase: SupabaseClient,
  brandProfileId: string,
  daysOld: number = 30
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const { data, error } = await supabase
    .from("brand_research_jobs")
    .delete()
    .eq("brand_profile_id", brandProfileId)
    .in("status", ["completed", "failed", "cancelled"])
    .lt("completed_at", cutoffDate.toISOString())
    .select("id");

  if (error) {
    console.error("[JobTracker] Cleanup failed:", error);
    return 0;
  }

  return data?.length || 0;
}
