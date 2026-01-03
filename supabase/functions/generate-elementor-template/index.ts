import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brand configuration (NetCo Body-Cam)
const BRAND = {
  brand_id: "netco_bodycam",
  colors: {
    primary: "#003366",
    secondary: "#ff6600",
    accent: "#ff8533",
    background_light: "#f8f8f8",
    background_white: "#ffffff",
    text_dark: "#333333",
  },
  typography: {
    heading_font: "Antonio",
    heading_weight: "700",
    body_font: "PT Sans",
  },
  font_sizes: {
    h1: { desktop: 52, mobile: 34 },
    h2: { desktop: 38, mobile: 28 },
    body: { desktop: 18, mobile: 16 },
  },
};

// ID Generator
class IDGenerator {
  private usedIds = new Set<string>();

  generate(prefix = ""): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (let attempt = 0; attempt < 100; attempt++) {
      let id = "";
      if (prefix) {
        id = prefix.toLowerCase().slice(0, 3);
        for (let i = 0; i < 4; i++) {
          id += chars[Math.floor(Math.random() * chars.length)];
        }
      } else {
        for (let i = 0; i < 7; i++) {
          id += chars[Math.floor(Math.random() * chars.length)];
        }
      }
      if (!this.usedIds.has(id)) {
        this.usedIds.add(id);
        return id;
      }
    }
    throw new Error("Failed to generate unique ID");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleId } = await req.json();

    if (!articleId) {
      return new Response(
        JSON.stringify({ error: "articleId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch article
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .single();

    if (articleError) {
      return new Response(
        JSON.stringify({ error: "Article not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating template for:", article.title);

    // Simple template for now - just create basic structure
    const idGen = new IDGenerator();

    const elementorJson = {
      content: [
        {
          id: idGen.generate("hero"),
          elType: "section",
          isInner: false,
          settings: {
            layout: "full_width",
            background_background: "gradient",
            background_color: BRAND.colors.primary,
            background_color_b: "#001a33",
            background_gradient_type: "linear",
            padding: { unit: "px", top: "100", right: "20", bottom: "100", left: "20", isLinked: false },
          },
          elements: [
            {
              id: idGen.generate("col"),
              elType: "column",
              isInner: false,
              settings: { _column_size: 100, _inline_size: null },
              elements: [
                {
                  id: idGen.generate("h1"),
                  elType: "widget",
                  widgetType: "heading",
                  isInner: false,
                  settings: {
                    title: article.title,
                    header_size: "h1",
                    title_color: "#ffffff",
                    typography_typography: "custom",
                    typography_font_family: BRAND.typography.heading_font,
                    typography_font_size: { unit: "px", size: BRAND.font_sizes.h1.desktop, sizes: [] },
                  },
                  elements: [],
                },
              ],
            },
          ],
        },
      ],
      page_settings: { hide_title: "yes" },
      version: "0.4",
      title: article.title,
      type: "page",
    };

    // Save template
    const { data: template, error: templateError } = await supabase
      .from("elementor_templates")
      .insert({
        project_id: article.project_id,
        article_id: articleId,
        name: `${article.title} - Template`,
        template_json: elementorJson,
        design_preset: "netco_bodycam",
      })
      .select()
      .single();

    if (templateError) {
      console.error("Error saving template:", templateError);
      return new Response(
        JSON.stringify({ error: "Failed to save template" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        templateId: template.id,
        name: template.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
