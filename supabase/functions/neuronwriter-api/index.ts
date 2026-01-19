import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NW_BASE_URL = "https://app.neuronwriter.com/neuron-api/0.5/writer";

interface NWRequestBody {
  action: "list-projects" | "list-queries" | "new-query" | "get-query" | "get-content" | "evaluate-content";
  apiKey?: string;       // Optional: User-provided API key (overrides env var)
  projectId?: string;
  queryId?: string;
  keyword?: string;
  language?: string;
  engine?: string;
  content?: string;      // Legacy - wird auf html gemappt für evaluate-content
  html?: string;         // HTML content für evaluate-content
  title?: string;        // Meta title für evaluate-content
  description?: string;  // Meta description für evaluate-content
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

    // Parse request body
    const body: NWRequestBody = await req.json();
    const { action, apiKey, projectId, queryId, keyword, language, engine, content, html, title, description, status, tags } = body;

    // Get NeuronWriter API key from request (project-specific)
    if (!apiKey) {
      console.error("No NeuronWriter API key provided in request");
      return new Response(JSON.stringify({
        error: "NeuronWriter API key not configured",
        message: "Bitte gib deinen NeuronWriter API Key in den Projekt-Einstellungen ein."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nwApiKey = apiKey;
    console.log("Using project-specific API key");

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

      case "evaluate-content": {
        // NeuronWriter API erwartet: query, html, title (optional), description (optional)
        const htmlContent = html || content; // Fallback auf content für Backwards-Compat
        if (!queryId || !htmlContent) {
          return new Response(JSON.stringify({ error: "queryId and html (or content) required for evaluate-content" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        endpoint = "/evaluate-content";
        requestBody = {
          query: queryId,
          html: htmlContent,
          ...(title && { title }),
          ...(description && { description }),
        };
        console.log("[evaluate-content] Evaluating content for query:", queryId);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Call NeuronWriter API
    console.log(`Calling NeuronWriter: ${NW_BASE_URL}${endpoint}`);
    console.log("Request body:", JSON.stringify(requestBody).substring(0, 500));

    const nwResponse = await fetch(`${NW_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": nwApiKey,
      },
      body: JSON.stringify(requestBody),
    });

    let nwData;
    try {
      nwData = await nwResponse.json();
    } catch (e) {
      console.error("Failed to parse NeuronWriter response:", e);
      const responseText = await nwResponse.text();
      console.error("Response text:", responseText);
      return new Response(JSON.stringify({
        error: "Invalid response from NeuronWriter API",
        status: nwResponse.status,
        statusText: nwResponse.statusText,
        responseText: responseText.substring(0, 500)
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!nwResponse.ok) {
      console.error("NeuronWriter API error:", {
        status: nwResponse.status,
        statusText: nwResponse.statusText,
        endpoint: `${NW_BASE_URL}${endpoint}`,
        responseData: nwData
      });

      return new Response(JSON.stringify({
        error: "NeuronWriter API error",
        message: nwData.message || nwData.error || "Unknown error from NeuronWriter API",
        details: nwData,
        status: nwResponse.status,
        statusText: nwResponse.statusText,
        endpoint: endpoint
      }), {
        status: nwResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`NeuronWriter ${action} success`, action === "evaluate-content" ? { score: nwData.content_score } : {});
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
