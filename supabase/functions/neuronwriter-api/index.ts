import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NW_BASE_URL = "https://app.neuronwriter.com/neuron-api/0.5/writer";

interface NWRequestBody {
  action: "list-projects" | "list-queries" | "new-query" | "get-query" | "get-content" | "evaluate-content";
  projectId?: string;
  queryId?: string;
  keyword?: string;
  language?: string;
  engine?: string;
  content?: string;
  status?: string;
  tags?: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header for user verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client to verify user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User authentication failed:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get NeuronWriter API key from secrets
    const nwApiKey = Deno.env.get("NEURONWRITER_API_KEY");
    if (!nwApiKey) {
      console.error("NEURONWRITER_API_KEY not configured");
      return new Response(JSON.stringify({ error: "NeuronWriter API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body: NWRequestBody = await req.json();
    const { action, projectId, queryId, keyword, language, engine, content, status, tags } = body;

    console.log(`NeuronWriter API call: ${action}`, { projectId, queryId, keyword, language, engine });

    let endpoint: string;
    let requestBody: Record<string, unknown> = {};

    switch (action) {
      case "list-projects":
        endpoint = "/list-projects";
        break;

      case "list-queries":
        if (!projectId) {
          return new Response(JSON.stringify({ error: "projectId required for list-queries" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        endpoint = "/list-queries";
        requestBody = { 
          project: projectId,
          ...(status && { status }),
          ...(tags && { tags }),
        };
        break;

      case "new-query":
        if (!projectId || !keyword) {
          return new Response(JSON.stringify({ error: "projectId and keyword required for new-query" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!language || !engine) {
          return new Response(JSON.stringify({ error: "language and engine required for new-query" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        endpoint = "/new-query";
        // NeuronWriter API expects 'keyword', 'language', and 'engine'
        requestBody = {
          project: projectId,
          keyword: keyword,
          language: language,
          engine: engine,
        };
        console.log("new-query payload:", JSON.stringify(requestBody));
        break;

      case "get-query":
        if (!queryId) {
          return new Response(JSON.stringify({ error: "queryId required for get-query" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        endpoint = "/get-query";
        requestBody = { query: queryId };
        break;

      case "get-content":
        if (!queryId) {
          return new Response(JSON.stringify({ error: "queryId required for get-content" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        endpoint = "/get-content";
        requestBody = { query: queryId };
        break;

      case "evaluate-content":
        if (!queryId || !content) {
          return new Response(JSON.stringify({ error: "queryId and content required for evaluate-content" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        endpoint = "/evaluate-content";
        requestBody = { query: queryId, content };
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Call NeuronWriter API
    console.log(`Calling NeuronWriter: ${NW_BASE_URL}${endpoint}`);
    const nwResponse = await fetch(`${NW_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": nwApiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const nwData = await nwResponse.json();

    if (!nwResponse.ok) {
      console.error("NeuronWriter API error:", nwResponse.status, nwData);
      return new Response(JSON.stringify({ 
        error: "NeuronWriter API error", 
        details: nwData,
        status: nwResponse.status 
      }), {
        status: nwResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`NeuronWriter ${action} success`);
    return new Response(JSON.stringify(nwData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in neuronwriter-api function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
