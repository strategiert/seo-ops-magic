import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompetitorResearchRequest {
  projectId: string;
  brandProfileId: string;
  industry?: string;
  keywords?: string[];
}

interface Competitor {
  name: string;
  domain: string;
  strengths: string[];
  weaknesses: string[];
  description?: string;
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
    const perplexityApiKey = Deno.env.get("PERPLEXITY_API_KEY");

    if (!perplexityApiKey) {
      return new Response(
        JSON.stringify({ error: "PERPLEXITY_API_KEY not configured" }),
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

    const body: CompetitorResearchRequest = await req.json();
    const { projectId, brandProfileId, industry, keywords } = body;

    if (!projectId || !brandProfileId) {
      return new Response(
        JSON.stringify({ error: "projectId and brandProfileId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, name, domain")
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

    // Load brand profile for context
    const { data: brandProfile, error: profileError } = await supabase
      .from("brand_profiles")
      .select("brand_name, products, services, brand_keywords")
      .eq("id", brandProfileId)
      .single();

    if (profileError || !brandProfile) {
      return new Response(
        JSON.stringify({ error: "Brand profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context for competitor research
    const brandName = brandProfile.brand_name || project.name;
    const brandDomain = project.domain || "";
    const products = (brandProfile.products as Array<{ name: string }>) || [];
    const services = (brandProfile.services as Array<{ name: string }>) || [];
    const brandKeywords = brandProfile.brand_keywords as { primary?: string[] } | null;
    const primaryKeywords = keywords || brandKeywords?.primary || [];

    const productServiceList = [
      ...products.map(p => p.name),
      ...services.map(s => s.name),
    ].slice(0, 5).join(", ");

    console.log(`brand-competitor-research: Researching competitors for ${brandName}`);

    // Build Perplexity query
    const researchQuery = `
Recherchiere die Hauptkonkurrenten für folgendes Unternehmen:

Unternehmen: ${brandName}
Domain: ${brandDomain}
Branche: ${industry || "Nicht angegeben"}
Produkte/Services: ${productServiceList || "Nicht angegeben"}
Keywords: ${primaryKeywords.join(", ") || "Nicht angegeben"}

Bitte identifiziere 3-5 Hauptkonkurrenten und analysiere für jeden:
1. Firmenname und Domain
2. Stärken (3-5 Punkte)
3. Schwächen (3-5 Punkte)
4. Kurze Beschreibung des Unternehmens

Antworte im JSON-Format:
{
  "competitors": [
    {
      "name": "Firmenname",
      "domain": "example.com",
      "description": "Kurze Beschreibung",
      "strengths": ["Stärke 1", "Stärke 2"],
      "weaknesses": ["Schwäche 1", "Schwäche 2"]
    }
  ]
}
`;

    // Call Perplexity API
    const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${perplexityApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        messages: [
          {
            role: "system",
            content: "Du bist ein Wettbewerbsanalyst. Recherchiere gründlich und liefere akkurate, aktuelle Informationen über Wettbewerber. Antworte immer auf Deutsch und im angeforderten JSON-Format.",
          },
          {
            role: "user",
            content: researchQuery,
          },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error("Perplexity API error:", perplexityResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Perplexity API error: ${perplexityResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const perplexityData = await perplexityResponse.json();
    const content = perplexityData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content from Perplexity");
    }

    // Parse JSON from response
    let competitors: Competitor[] = [];
    try {
      // Extract JSON from response
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      // Find JSON object in response
      const jsonMatch = jsonStr.match(/\{[\s\S]*"competitors"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        competitors = parsed.competitors || [];
      }
    } catch (parseError) {
      console.error("Failed to parse Perplexity response:", parseError);
      console.log("Raw content:", content);
    }

    console.log(`brand-competitor-research: Found ${competitors.length} competitors`);

    // Update brand profile with competitors
    if (competitors.length > 0) {
      const { error: updateError } = await supabase
        .from("brand_profiles")
        .update({
          competitors: competitors,
          updated_at: new Date().toISOString(),
        })
        .eq("id", brandProfileId);

      if (updateError) {
        console.error("Failed to update brand profile:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        competitors,
        source: "perplexity",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("brand-competitor-research: Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
