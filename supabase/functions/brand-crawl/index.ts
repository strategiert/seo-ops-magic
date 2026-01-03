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

interface FirecrawlPage {
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: {
    sourceURL?: string;
    title?: string;
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    language?: string;
    statusCode?: number;
  };
}

// Detect page type from URL and content
function detectPageType(url: string | undefined, title: string | undefined, content: string | undefined): string {
  const lowerUrl = (url || "").toLowerCase();
  const lowerTitle = (title || "").toLowerCase();
  const lowerContent = (content || "").substring(0, 2000).toLowerCase();

  if (lowerUrl === "/" || lowerUrl.endsWith("/") && lowerUrl.split("/").filter(Boolean).length <= 1) {
    return "homepage";
  }
  if (lowerUrl.includes("/about") || lowerUrl.includes("/ueber") || lowerUrl.includes("/unternehmen") || lowerTitle.includes("über uns")) {
    return "about";
  }
  if (lowerUrl.includes("/product") || lowerUrl.includes("/produkt") || lowerUrl.includes("/shop")) {
    return "product";
  }
  if (lowerUrl.includes("/service") || lowerUrl.includes("/leistung") || lowerUrl.includes("/dienstleistung")) {
    return "service";
  }
  if (lowerUrl.includes("/blog") || lowerUrl.includes("/news") || lowerUrl.includes("/artikel")) {
    return "blog";
  }
  if (lowerUrl.includes("/contact") || lowerUrl.includes("/kontakt")) {
    return "contact";
  }
  if (lowerUrl.includes("/team") || lowerUrl.includes("/mitarbeiter")) {
    return "team";
  }
  if (lowerUrl.includes("/preis") || lowerUrl.includes("/pricing") || lowerUrl.includes("/tarif")) {
    return "pricing";
  }

  return "other";
}

// Extract headings from markdown
function extractHeadings(markdown: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }
  }

  return headings;
}

// Extract internal and external links
function extractLinks(baseUrl: string, links: string[]): { internal: string[]; external: string[] } {
  const internal: string[] = [];
  const external: string[] = [];

  const baseDomain = new URL(baseUrl).hostname;

  for (const link of links || []) {
    try {
      const url = new URL(link, baseUrl);
      if (url.hostname === baseDomain) {
        internal.push(url.href);
      } else {
        external.push(url.href);
      }
    } catch {
      // Skip invalid URLs
    }
  }

  return { internal: [...new Set(internal)], external: [...new Set(external)] };
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
      return new Response(
        JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }),
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
      // Update existing profile
      const { data: updated, error: updateError } = await supabase
        .from("brand_profiles")
        .update({
          crawl_status: "crawling",
          crawl_error: null,
          last_crawl_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id)
        .select()
        .single();

      if (updateError) throw updateError;
      brandProfile = updated;

      // Delete old crawl data
      await supabase
        .from("brand_crawl_data")
        .delete()
        .eq("brand_profile_id", existingProfile.id);
    } else {
      // Create new profile
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

    console.log(`brand-crawl: Starting crawl for ${websiteUrl}`);

    // Call Firecrawl API to crawl the website
    const crawlResponse = await fetch("https://api.firecrawl.dev/v1/crawl", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: websiteUrl,
        limit: maxPages,
        scrapeOptions: {
          formats: ["markdown"],
          includeTags: ["main", "article", "section", "div", "p", "h1", "h2", "h3", "h4", "ul", "ol", "li"],
          excludeTags: ["nav", "footer", "header", "aside", "script", "style"],
        },
      }),
    });

    if (!crawlResponse.ok) {
      const errorText = await crawlResponse.text();
      console.error("brand-crawl: Firecrawl error:", crawlResponse.status, errorText);

      await supabase
        .from("brand_profiles")
        .update({ crawl_status: "error", crawl_error: `Firecrawl error: ${crawlResponse.status}` })
        .eq("id", brandProfile.id);

      return new Response(
        JSON.stringify({ error: `Firecrawl error: ${crawlResponse.status}`, details: errorText }),
        { status: crawlResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const crawlData = await crawlResponse.json();

    // Firecrawl v1 returns a job ID for async crawling
    if (crawlData.id) {
      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      let completed = false;
      let pages: FirecrawlPage[] = [];

      while (attempts < maxAttempts && !completed) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

        const statusResponse = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlData.id}`, {
          headers: {
            "Authorization": `Bearer ${firecrawlApiKey}`,
          },
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log(`brand-crawl: Status check ${attempts + 1}: ${statusData.status}, pages: ${statusData.data?.length || 0}`);

          // Log more details for debugging
          if (statusData.status === "completed") {
            console.log(`brand-crawl: Firecrawl response:`, JSON.stringify({
              total: statusData.total,
              completed: statusData.completed,
              creditsUsed: statusData.creditsUsed,
              expiresAt: statusData.expiresAt,
              dataLength: statusData.data?.length || 0,
              firstPageUrl: statusData.data?.[0]?.metadata?.sourceURL || "none"
            }));
          }

          if (statusData.status === "completed") {
            completed = true;
            pages = statusData.data || [];
          } else if (statusData.status === "failed") {
            throw new Error("Crawl job failed");
          }
        }

        attempts++;
      }

      if (!completed) {
        await supabase
          .from("brand_profiles")
          .update({ crawl_status: "error", crawl_error: "Crawl timeout" })
          .eq("id", brandProfile.id);

        return new Response(
          JSON.stringify({ error: "Crawl timeout", brandProfileId: brandProfile.id }),
          { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Process and store crawled pages
      console.log(`brand-crawl: Processing ${pages.length} pages`);

      for (const page of pages) {
        const pageUrl = page.metadata?.sourceURL;

        // Skip pages without URL
        if (!pageUrl) {
          console.log("brand-crawl: Skipping page without sourceURL");
          continue;
        }

        const pageType = detectPageType(pageUrl, page.metadata?.title, page.markdown);
        const headings = extractHeadings(page.markdown || "");
        const links = extractLinks(websiteUrl, page.links || []);

        // Calculate relevance score (higher for important page types)
        let relevanceScore = 0.5;
        if (pageType === "homepage") relevanceScore = 1.0;
        else if (pageType === "about") relevanceScore = 0.9;
        else if (pageType === "product" || pageType === "service") relevanceScore = 0.85;
        else if (pageType === "pricing") relevanceScore = 0.8;
        else if (pageType === "team") relevanceScore = 0.7;
        else if (pageType === "contact") relevanceScore = 0.6;
        else if (pageType === "blog") relevanceScore = 0.4;

        await supabase
          .from("brand_crawl_data")
          .insert({
            brand_profile_id: brandProfile.id,
            url: pageUrl,
            page_type: pageType,
            title: page.metadata?.title || null,
            content_markdown: page.markdown || null,
            meta_description: page.metadata?.description || page.metadata?.ogDescription || null,
            headings: headings,
            internal_links: links.internal.map(url => ({ href: url })),
            external_links: links.external.map(url => ({ href: url })),
            relevance_score: relevanceScore,
          });
      }

      // Update brand profile status
      await supabase
        .from("brand_profiles")
        .update({
          crawl_status: "analyzing",
          internal_links: pages
            .filter(p => p.metadata?.sourceURL && detectPageType(p.metadata.sourceURL, p.metadata?.title, p.markdown) !== "blog")
            .map(p => ({
              url: p.metadata!.sourceURL,
              title: p.metadata?.title || p.metadata!.sourceURL,
              page_type: detectPageType(p.metadata!.sourceURL, p.metadata?.title, p.markdown),
            }))
            .slice(0, 50), // Limit to 50 links
        })
        .eq("id", brandProfile.id);

      console.log(`brand-crawl: Completed. ${pages.length} pages stored.`);

      return new Response(
        JSON.stringify({
          success: true,
          brandProfileId: brandProfile.id,
          pagesFound: pages.length,
          status: "analyzing",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle synchronous response (fallback)
    return new Response(
      JSON.stringify({
        success: true,
        brandProfileId: brandProfile.id,
        status: "crawling",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("brand-crawl: Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
