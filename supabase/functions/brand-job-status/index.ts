// supabase/functions/brand-job-status/index.ts
// Job Status Endpoint - Check progress of long-running research jobs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getJobStatus, listJobs } from "../_shared/job-tracker.ts";
import type { JobStatusResponse } from "../_shared/brand-research-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth check
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const url = new URL(req.url);
    const jobId = url.searchParams.get("jobId");
    const brandProfileId = url.searchParams.get("brandProfileId");
    const action = url.searchParams.get("action") || "status";

    // Action: List jobs for a brand profile
    if (action === "list" && brandProfileId) {
      // Verify ownership
      const { data: profile } = await supabase
        .from("brand_profiles")
        .select(`
          id,
          project:projects (
            workspace:workspaces ( owner_id )
          )
        `)
        .eq("id", brandProfileId)
        .single();

      if (!profile || profile.project?.workspace?.owner_id !== user.id) {
        throw new Error("Forbidden");
      }

      const jobs = await listJobs(supabase, brandProfileId, {
        limit: parseInt(url.searchParams.get("limit") || "10"),
      });

      return new Response(JSON.stringify({ success: true, jobs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Get specific job status
    if (!jobId) {
      throw new Error("jobId is required");
    }

    // Get job and verify ownership
    const { data: job, error: jobError } = await supabase
      .from("brand_research_jobs")
      .select(`
        *,
        brand_profile:brand_profiles (
          id,
          project:projects (
            workspace:workspaces ( owner_id )
          )
        )
      `)
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      throw new Error("Job not found");
    }

    if (job.brand_profile?.project?.workspace?.owner_id !== user.id) {
      throw new Error("Forbidden");
    }

    const response: JobStatusResponse = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStep: job.current_step,
      stepsCompleted: job.steps_completed,
      stepsTotal: job.steps_total,
      result: job.result,
      error: job.error_message,
      startedAt: job.started_at,
      completedAt: job.completed_at,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[brand-job-status] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
