import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CrawlRequest {
  projectId: string;
  websiteUrl: string;
  maxPages?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (!firecrawlApiKey) {
      console.error("brand-crawl: FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Crawl service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await authSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CrawlRequest = await req.json();
    const { projectId, websiteUrl, maxPages = 20 } = body;

    if (!projectId || !websiteUrl) {
      return new Response(
        JSON.stringify({ error: "projectId and websiteUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, domain")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", project.workspace_id)
      .single();

    if (!workspace || workspace.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or update brand profile
    let brandProfile;
    const { data: existingProfile } = await supabase
      .from("brand_profiles")
      .select("id")
      .eq("project_id", projectId)
      .single();

    if (existingProfile) {
      const { data: updated, error: updateError } = await supabase
        .from("brand_profiles")
        .update({
          crawl_status: "crawling",
          crawl_error: null,
          crawl_job_id: null, // Will be set after Firecrawl responds
          last_crawl_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id)
        .select()
        .single();

      if (updateError) throw updateError;
      brandProfile = updated;
    } else {
      const { data: created, error: createError } = await supabase
        .from("brand_profiles")
        .insert({
          project_id: projectId,
          crawl_status: "crawling",
          last_crawl_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) throw createError;
      brandProfile = created;
    }

    // Format URL properly
    let formattedUrl = websiteUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log(`brand-crawl: Starting crawl for ${formattedUrl}`);

    // Webhook URL - Firecrawl will call this when done
    const webhookUrl = `${supabaseUrl}/functions/v1/brand-crawl-webhook`;

    // Call Firecrawl API v2 with webhook
    const crawlRequestBody = {
      url: formattedUrl,
      limit: maxPages,
      scrapeOptions: {
        formats: ["markdown"],
      },
      webhook: webhookUrl, // Firecrawl calls this URL when done
    };

    console.log(`brand-crawl: Request body:`, JSON.stringify(crawlRequestBody));

    const crawlResponse = await fetch("https://api.firecrawl.dev/v2/crawl", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(crawlRequestBody),
    });

    const crawlResponseText = await crawlResponse.text();
    console.log(`brand-crawl: Firecrawl response (${crawlResponse.status}):`, crawlResponseText);

    if (!crawlResponse.ok) {
      console.error("brand-crawl: Firecrawl error:", crawlResponse.status, crawlResponseText);

      await supabase
        .from("brand_profiles")
        .update({ crawl_status: "error", crawl_error: "Website crawl failed" })
        .eq("id", brandProfile.id);

      return new Response(
        JSON.stringify({ error: "Failed to crawl website. Please check the URL and try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let crawlData;
    try {
      crawlData = JSON.parse(crawlResponseText);
    } catch (e) {
      console.error("brand-crawl: Failed to parse Firecrawl response:", e);
      throw new Error("Invalid Firecrawl response");
    }

    // Store job ID so webhook can find the brand profile
    const jobId = crawlData.id || crawlData.jobId;

    if (jobId) {
      await supabase
        .from("brand_profiles")
        .update({ crawl_job_id: jobId })
        .eq("id", brandProfile.id);

      console.log(`brand-crawl: Job started with ID ${jobId}. Webhook will process results.`);
    } else {
      console.warn("brand-crawl: No job ID returned from Firecrawl");
    }

    // Return immediately - webhook will handle the rest
    return new Response(
      JSON.stringify({
        success: true,
        brandProfileId: brandProfile.id,
        jobId: jobId,
        status: "crawling",
        message: "Crawl started. Results will be processed via webhook.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("brand-crawl: Error:", error);

    // Try to update error status
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const errorSupabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await req.clone().json().catch(() => ({}));
        if (body.projectId) {
          await errorSupabase
            .from("brand_profiles")
            .update({
              crawl_status: "error",
              crawl_error: error instanceof Error ? error.message : "Unknown error",
            })
            .eq("project_id", body.projectId);
        }
      }
    } catch (updateError) {
      console.error("brand-crawl: Failed to update error status:", updateError);
    }

    return new Response(
      JSON.stringify({ error: "An error occurred while crawling" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
