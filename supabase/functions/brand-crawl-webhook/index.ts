import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  FirecrawlPage,
  transformPagesToRows,
  transformPagesToInternalLinks,
} from "../_shared/crawl-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload from Firecrawl
    const webhookData = await req.json();
    const jobId = webhookData.jobId || webhookData.id;

    console.log("brand-crawl-webhook: Received:", JSON.stringify({
      success: webhookData.success,
      status: webhookData.status,
      dataLength: webhookData.data?.length || 0,
      jobId,
    }));

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "No job ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find brand profile by crawl_job_id
    const { data: brandProfile, error: profileError } = await supabase
      .from("brand_profiles")
      .select("id, project_id")
      .eq("crawl_job_id", jobId)
      .single();

    if (profileError || !brandProfile) {
      console.error("brand-crawl-webhook: Profile not found for job:", jobId);
      return new Response(
        JSON.stringify({ error: "Brand profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if crawl failed
    if (!webhookData.success || webhookData.status === "failed") {
      await supabase
        .from("brand_profiles")
        .update({
          crawl_status: "error",
          crawl_error: webhookData.error || "Crawl failed"
        })
        .eq("id", brandProfile.id);

      return new Response(
        JSON.stringify({ error: "Crawl failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get pages - handle different response formats
    const pages: FirecrawlPage[] = Array.isArray(webhookData.data)
      ? webhookData.data
      : (webhookData.results || []);

    console.log(`brand-crawl-webhook: Processing ${pages.length} pages`);

    if (pages.length === 0) {
      await supabase
        .from("brand_profiles")
        .update({
          crawl_status: "error",
          crawl_error: "No pages crawled - check robots.txt"
        })
        .eq("id", brandProfile.id);

      return new Response(
        JSON.stringify({ success: false, error: "No pages" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete old crawl data
    await supabase
      .from("brand_crawl_data")
      .delete()
      .eq("brand_profile_id", brandProfile.id);

    // BULK INSERT: Transform all pages at once
    const websiteUrl = pages[0]?.metadata?.sourceURL || "";
    const rowsToInsert = transformPagesToRows(pages, brandProfile.id, websiteUrl);

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("brand_crawl_data")
        .insert(rowsToInsert);

      if (insertError) {
        console.error("brand-crawl-webhook: Bulk insert error:", insertError);
        throw insertError;
      }
    }

    // Update brand profile with internal links
    await supabase
      .from("brand_profiles")
      .update({
        crawl_status: "analyzing",
        internal_links: transformPagesToInternalLinks(pages),
      })
      .eq("id", brandProfile.id);

    console.log(`brand-crawl-webhook: Stored ${rowsToInsert.length} pages. Triggering analysis...`);

    // Auto-trigger brand-analyze
    try {
      const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/brand-analyze`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: brandProfile.project_id,
          brandProfileId: brandProfile.id,
        }),
      });

      if (!analyzeResponse.ok) {
        console.error("brand-crawl-webhook: Auto-analyze failed:", await analyzeResponse.text());
      } else {
        console.log("brand-crawl-webhook: Auto-analyze completed");
      }
    } catch (analyzeError) {
      console.error("brand-crawl-webhook: Auto-analyze error:", analyzeError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        brandProfileId: brandProfile.id,
        pagesProcessed: rowsToInsert.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("brand-crawl-webhook: Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
