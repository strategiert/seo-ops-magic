import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Elementor element ID generator
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Convert markdown to Elementor elements
function markdownToElementor(markdown: string, faq: any[] = []): any[] {
  const elements: any[] = [];
  const lines = markdown.split("\n");
  let currentParagraph = "";

  const flushParagraph = () => {
    if (currentParagraph.trim()) {
      elements.push({
        id: generateId(),
        elType: "widget",
        widgetType: "text-editor",
        settings: {
          editor: `<p>${currentParagraph.trim()}</p>`,
        },
      });
      currentParagraph = "";
    }
  };

  for (const line of lines) {
    // H1
    if (line.startsWith("# ")) {
      flushParagraph();
      elements.push({
        id: generateId(),
        elType: "widget",
        widgetType: "heading",
        settings: {
          title: line.replace("# ", ""),
          header_size: "h1",
        },
      });
    }
    // H2
    else if (line.startsWith("## ")) {
      flushParagraph();
      elements.push({
        id: generateId(),
        elType: "widget",
        widgetType: "heading",
        settings: {
          title: line.replace("## ", ""),
          header_size: "h2",
        },
      });
    }
    // H3
    else if (line.startsWith("### ")) {
      flushParagraph();
      elements.push({
        id: generateId(),
        elType: "widget",
        widgetType: "heading",
        settings: {
          title: line.replace("### ", ""),
          header_size: "h3",
        },
      });
    }
    // H4
    else if (line.startsWith("#### ")) {
      flushParagraph();
      elements.push({
        id: generateId(),
        elType: "widget",
        widgetType: "heading",
        settings: {
          title: line.replace("#### ", ""),
          header_size: "h4",
        },
      });
    }
    // List item
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph();
      elements.push({
        id: generateId(),
        elType: "widget",
        widgetType: "icon-list",
        settings: {
          icon_list: [
            {
              text: line.replace(/^[-*] /, ""),
              icon: { value: "fas fa-check", library: "fa-solid" },
            },
          ],
        },
      });
    }
    // Empty line
    else if (line.trim() === "") {
      flushParagraph();
    }
    // Regular text
    else {
      currentParagraph += (currentParagraph ? " " : "") + line;
    }
  }

  flushParagraph();

  // Add FAQ section if present
  if (faq && faq.length > 0) {
    elements.push({
      id: generateId(),
      elType: "widget",
      widgetType: "heading",
      settings: {
        title: "Häufig gestellte Fragen",
        header_size: "h2",
      },
    });

    elements.push({
      id: generateId(),
      elType: "widget",
      widgetType: "accordion",
      settings: {
        tabs: faq.map((item, index) => ({
          tab_title: item.question,
          tab_content: item.answer,
        })),
      },
    });
  }

  return elements;
}

// Wrap elements in Elementor section/container structure
function wrapInContainer(elements: any[]): any {
  return {
    version: "0.4",
    title: "Generated Template",
    type: "page",
    content: [
      {
        id: generateId(),
        elType: "container",
        settings: {
          content_width: "boxed",
          padding: {
            unit: "px",
            top: "40",
            right: "20",
            bottom: "40",
            left: "20",
          },
        },
        elements: elements,
      },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleId, designPreset = "default" } = await req.json();

    if (!articleId) {
      return new Response(
        JSON.stringify({ error: "articleId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the article
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .single();

    if (articleError || !article) {
      console.error("Article not found:", articleError);
      return new Response(
        JSON.stringify({ error: "Article not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!article.content_markdown) {
      return new Response(
        JSON.stringify({ error: "Article has no content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Converting article to Elementor template:", article.title);

    // Convert markdown to Elementor elements
    const faq = Array.isArray(article.faq_json) ? article.faq_json : [];
    const elements = markdownToElementor(article.content_markdown, faq);
    const templateJson = wrapInContainer(elements);

    // Check if template already exists for this article
    const { data: existingTemplate } = await supabase
      .from("elementor_templates")
      .select("id")
      .eq("article_id", articleId)
      .single();

    let template;
    if (existingTemplate) {
      // Update existing template
      const { data, error } = await supabase
        .from("elementor_templates")
        .update({
          name: article.title,
          design_preset: designPreset,
          template_json: templateJson,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTemplate.id)
        .select()
        .single();

      if (error) throw error;
      template = data;
    } else {
      // Create new template
      const { data, error } = await supabase
        .from("elementor_templates")
        .insert({
          project_id: article.project_id,
          article_id: articleId,
          name: article.title,
          design_preset: designPreset,
          template_json: templateJson,
        })
        .select()
        .single();

      if (error) throw error;
      template = data;
    }

    console.log("Template created/updated:", template.id);

    return new Response(
      JSON.stringify({
        success: true,
        templateId: template.id,
        name: template.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-elementor-template:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
