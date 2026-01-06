import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaxonomyItem {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user from the incoming JWT using getClaims
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.log("wordpress-taxonomies: auth failed", claimsError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = { id: claimsData.claims.sub as string };

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const projectId = body?.projectId as string | undefined;

    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, wp_url, workspace_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership (workspace owner)
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", project.workspace_id)
      .single();

    if (workspaceError || !workspace || workspace.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WordPress credentials
    const { data: integration, error: integrationError } = await supabase
      .from("integrations")
      .select("wp_username, wp_app_password")
      .eq("project_id", projectId)
      .eq("type", "wordpress")
      .single();

    if (integrationError || !integration?.wp_username || !integration?.wp_app_password) {
      return new Response(JSON.stringify({ error: "WordPress not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!project.wp_url) {
      return new Response(JSON.stringify({ error: "WordPress URL not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = project.wp_url.replace(/\/$/, "").replace(/\/wp-json$/, "");
    const authString = btoa(`${integration.wp_username}:${integration.wp_app_password}`);

    const [categoriesResponse, tagsResponse] = await Promise.all([
      fetch(`${baseUrl}/wp-json/wp/v2/categories?per_page=100`, {
        headers: { Authorization: `Basic ${authString}` },
      }),
      fetch(`${baseUrl}/wp-json/wp/v2/tags?per_page=100`, {
        headers: { Authorization: `Basic ${authString}` },
      }),
    ]);

    if (!categoriesResponse.ok || !tagsResponse.ok) {
      const catText = await categoriesResponse.text().catch(() => "");
      const tagText = await tagsResponse.text().catch(() => "");
      console.log("wordpress-taxonomies: wp error", {
        categoriesStatus: categoriesResponse.status,
        tagsStatus: tagsResponse.status,
        catText: catText.slice(0, 500),
        tagText: tagText.slice(0, 500),
      });

      return new Response(JSON.stringify({ error: "Failed to fetch taxonomies from WordPress" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categoriesData = await categoriesResponse.json();
    const tagsData = await tagsResponse.json();

    const categories: TaxonomyItem[] = (categoriesData || []).map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: cat.count,
      parent: cat.parent || undefined,
    }));

    const tags: TaxonomyItem[] = (tagsData || []).map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      count: tag.count,
    }));

    console.log(`wordpress-taxonomies: fetched categories=${categories.length} tags=${tags.length} project=${projectId}`);

    return new Response(JSON.stringify({ categories, tags }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("wordpress-taxonomies: unhandled error", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
