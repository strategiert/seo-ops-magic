import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VectorStoreRequest {
  projectId: string;
  brandProfileId: string;
  action: "sync" | "query";
  query?: string;
  topK?: number;
}

interface BrandDocument {
  type: string;
  title: string;
  content: string;
}

// Build documents from brand profile
function buildBrandDocuments(brandProfile: Record<string, unknown>): BrandDocument[] {
  const documents: BrandDocument[] = [];

  // Core Brand Identity
  if (brandProfile.brand_name || brandProfile.tagline || brandProfile.mission_statement) {
    documents.push({
      type: "brand_core",
      title: "Brand Core Identity",
      content: `
Brand Name: ${brandProfile.brand_name || "Unknown"}
Tagline: ${brandProfile.tagline || "None"}
Mission Statement: ${brandProfile.mission_statement || "None"}
Brand Story: ${brandProfile.brand_story || "None"}
      `.trim(),
    });
  }

  // Brand Voice
  const brandVoice = brandProfile.brand_voice as Record<string, unknown> | null;
  if (brandVoice) {
    const tone = (brandVoice.tone as string[]) || [];
    const traits = (brandVoice.personality_traits as string[]) || [];
    const style = brandVoice.writing_style as Record<string, string> | null;

    documents.push({
      type: "brand_voice",
      title: "Brand Voice Guidelines",
      content: `
Brand Voice and Tonality:

Tone: ${tone.join(", ") || "Not defined"}
Personality Traits: ${traits.join(", ") || "Not defined"}

Writing Style:
- Formality: ${style?.formality || "Not defined"}
- Sentence Length: ${style?.sentence_length || "Not defined"}
- Vocabulary Level: ${style?.vocabulary_level || "Not defined"}
- Use of Jargon: ${style?.use_of_jargon || "Not defined"}

When writing content for this brand, always maintain this voice and tonality.
      `.trim(),
    });
  }

  // Products
  const products = (brandProfile.products as Array<Record<string, unknown>>) || [];
  for (const product of products) {
    const features = (product.features as string[]) || [];
    documents.push({
      type: "product",
      title: `Product: ${product.name}`,
      content: `
Product: ${product.name}
Description: ${product.description || "No description"}
Price: ${product.price || "Not specified"}
Category: ${product.category || "Not categorized"}
Features: ${features.join(", ") || "None listed"}
      `.trim(),
    });
  }

  // Services
  const services = (brandProfile.services as Array<Record<string, unknown>>) || [];
  for (const service of services) {
    documents.push({
      type: "service",
      title: `Service: ${service.name}`,
      content: `
Service: ${service.name}
Description: ${service.description || "No description"}
Pricing Model: ${service.pricing_model || "Not specified"}
Target Audience: ${service.target_audience || "Not specified"}
      `.trim(),
    });
  }

  // Personas
  const personas = (brandProfile.personas as Array<Record<string, unknown>>) || [];
  for (const persona of personas) {
    const painPoints = (persona.pain_points as string[]) || [];
    const goals = (persona.goals as string[]) || [];
    const channels = (persona.preferred_channels as string[]) || [];
    documents.push({
      type: "persona",
      title: `Target Persona: ${persona.name}`,
      content: `
Target Persona: ${persona.name}
Demographics: ${persona.demographics || "Not specified"}
Pain Points: ${painPoints.join("; ") || "None identified"}
Goals: ${goals.join("; ") || "None identified"}
Preferred Channels: ${channels.join(", ") || "Not specified"}

When creating content for this audience, address their pain points and help them achieve their goals.
      `.trim(),
    });
  }

  // Keywords
  const keywords = brandProfile.brand_keywords as Record<string, string[]> | null;
  if (keywords) {
    documents.push({
      type: "keywords",
      title: "Brand Keywords",
      content: `
SEO Keywords and Topics:

Primary Keywords (most important):
${(keywords.primary || []).map(k => `- ${k}`).join("\n")}

Secondary Keywords:
${(keywords.secondary || []).map(k => `- ${k}`).join("\n")}

Long-Tail Keywords:
${(keywords.long_tail || []).map(k => `- ${k}`).join("\n")}

Include these keywords naturally in content when relevant.
      `.trim(),
    });
  }

  // Competitors
  const competitors = (brandProfile.competitors as Array<Record<string, unknown>>) || [];
  if (competitors.length > 0) {
    const compContent = competitors.map(c => {
      const strengths = (c.strengths as string[]) || [];
      const weaknesses = (c.weaknesses as string[]) || [];
      return `
Competitor: ${c.name} (${c.domain})
Strengths: ${strengths.join(", ") || "Unknown"}
Weaknesses: ${weaknesses.join(", ") || "Unknown"}
      `.trim();
    }).join("\n\n");

    documents.push({
      type: "competitor",
      title: "Competitor Analysis",
      content: `
Competitive Landscape:

${compContent}

Differentiate from competitors by emphasizing unique value propositions.
      `.trim(),
    });
  }

  return documents;
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
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
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

    const body: VectorStoreRequest = await req.json();
    const { projectId, brandProfileId, action, query, topK = 5 } = body;

    if (!projectId || !brandProfileId) {
      return new Response(
        JSON.stringify({ error: "projectId and brandProfileId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, workspace_id, name")
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

    // Load brand profile
    const { data: brandProfile, error: profileError } = await supabase
      .from("brand_profiles")
      .select("*")
      .eq("id", brandProfileId)
      .single();

    if (profileError || !brandProfile) {
      return new Response(
        JSON.stringify({ error: "Brand profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "sync") {
      console.log(`brand-vector-store: Syncing vector store for project ${projectId}`);

      // Build documents from brand profile
      const documents = buildBrandDocuments(brandProfile);

      if (documents.length === 0) {
        return new Response(
          JSON.stringify({ error: "No brand data to sync" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if vector store exists
      let vectorStoreId = brandProfile.openai_vector_store_id;

      if (!vectorStoreId) {
        // Create new vector store
        const createResponse = await fetch("https://api.openai.com/v1/vector_stores", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
          },
          body: JSON.stringify({
            name: `Brand: ${project.name}`,
            metadata: {
              project_id: projectId,
              brand_profile_id: brandProfileId,
            },
          }),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error("Failed to create vector store:", errorText);
          throw new Error(`Failed to create vector store: ${createResponse.status}`);
        }

        const vectorStore = await createResponse.json();
        vectorStoreId = vectorStore.id;

        // Save vector store ID to brand profile
        await supabase
          .from("brand_profiles")
          .update({ openai_vector_store_id: vectorStoreId })
          .eq("id", brandProfileId);

        console.log(`brand-vector-store: Created vector store ${vectorStoreId}`);
      }

      // Delete existing files from database tracking
      await supabase
        .from("brand_vector_documents")
        .delete()
        .eq("brand_profile_id", brandProfileId);

      // Upload documents as files
      const uploadedDocs: Array<{ type: string; fileId: string; title: string }> = [];

      for (const doc of documents) {
        // Create file content
        const fileContent = `# ${doc.title}\n\n${doc.content}`;
        const blob = new Blob([fileContent], { type: "text/plain" });
        const formData = new FormData();
        formData.append("file", blob, `${doc.type}_${Date.now()}.txt`);
        formData.append("purpose", "assistants");

        // Upload file to OpenAI
        const uploadResponse = await fetch("https://api.openai.com/v1/files", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          console.error(`Failed to upload file for ${doc.type}:`, await uploadResponse.text());
          continue;
        }

        const uploadedFile = await uploadResponse.json();

        // Add file to vector store
        const addFileResponse = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
          },
          body: JSON.stringify({
            file_id: uploadedFile.id,
          }),
        });

        if (addFileResponse.ok) {
          uploadedDocs.push({
            type: doc.type,
            fileId: uploadedFile.id,
            title: doc.title,
          });

          // Track document in database
          await supabase
            .from("brand_vector_documents")
            .insert({
              brand_profile_id: brandProfileId,
              openai_file_id: uploadedFile.id,
              document_type: doc.type,
              title: doc.title,
              content_preview: doc.content.substring(0, 200),
              token_count: Math.ceil(doc.content.length / 4), // Rough estimate
            });
        }
      }

      console.log(`brand-vector-store: Uploaded ${uploadedDocs.length} documents`);

      return new Response(
        JSON.stringify({
          success: true,
          vectorStoreId,
          documentsUploaded: uploadedDocs.length,
          documents: uploadedDocs.map(d => ({ type: d.type, title: d.title })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "query") {
      if (!query) {
        return new Response(
          JSON.stringify({ error: "Query is required for query action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const vectorStoreId = brandProfile.openai_vector_store_id;
      if (!vectorStoreId) {
        return new Response(
          JSON.stringify({ error: "Vector store not initialized. Please sync first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`brand-vector-store: Querying vector store ${vectorStoreId}`);

      // Use file search to query the vector store
      // Note: OpenAI's vector store API uses a different approach for search
      // We'll use the assistants API to create a temporary thread and run a search

      // For now, return the brand profile data as context
      // Full vector search would require creating an assistant and thread
      const context = buildBrandDocuments(brandProfile)
        .map(d => d.content)
        .join("\n\n---\n\n");

      return new Response(
        JSON.stringify({
          success: true,
          query,
          context,
          vectorStoreId,
          note: "Returning full brand context. Vector search optimization coming soon.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'sync' or 'query'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("brand-vector-store: Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
