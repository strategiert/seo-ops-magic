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
    h3: { desktop: 28, mobile: 22 },
    body: { desktop: 18, mobile: 16 },
  },
};

// ID Generator - lowercase, 7-8 chars, alphanumeric only
class IDGenerator {
  private usedIds = new Set<string>();

  generate(prefix = ""): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (let attempt = 0; attempt < 100; attempt++) {
      let id = "";
      if (prefix) {
        id = prefix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 3);
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

interface OutlineItem {
  level: number;
  text: string;
}

interface FAQ {
  question: string;
  answer: string;
}

interface ContentSection {
  heading: string;
  level: number;
  content: string;
}

// Parse markdown directly - more robust approach
function parseMarkdownSections(markdown: string): ContentSection[] {
  const sections: ContentSection[] = [];
  const lines = markdown.split('\n');

  let currentSection: ContentSection | null = null;
  let contentBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for H2
    if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
      // Save previous section
      if (currentSection && contentBuffer.length > 0) {
        currentSection.content = contentBuffer.join('\n').trim();
        sections.push(currentSection);
      }

      const heading = trimmed.substring(3).trim();

      // Skip FAQ sections
      if (!heading.toLowerCase().includes('faq') &&
          !heading.toLowerCase().includes('häufig') &&
          !heading.toLowerCase().includes('fragen')) {
        currentSection = {
          heading,
          level: 2,
          content: ''
        };
        contentBuffer = [];
      } else {
        currentSection = null;
        contentBuffer = [];
      }
    }
    // Check for H3
    else if (trimmed.startsWith('### ')) {
      // Save previous section
      if (currentSection && contentBuffer.length > 0) {
        currentSection.content = contentBuffer.join('\n').trim();
        sections.push(currentSection);
      }

      const heading = trimmed.substring(4).trim();

      // Skip if it's in FAQ context
      if (!heading.toLowerCase().includes('faq') &&
          !heading.toLowerCase().includes('häufig')) {
        currentSection = {
          heading,
          level: 3,
          content: ''
        };
        contentBuffer = [];
      } else {
        currentSection = null;
        contentBuffer = [];
      }
    }
    // Skip H1
    else if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      continue;
    }
    // Collect content
    else if (currentSection) {
      contentBuffer.push(line);
    }
  }

  // Save last section
  if (currentSection && contentBuffer.length > 0) {
    currentSection.content = contentBuffer.join('\n').trim();
    sections.push(currentSection);
  }

  console.log(`Parsed ${sections.length} sections from markdown`);
  return sections;
}

// Section Builder
class ElementorBuilder {
  private idGen: IDGenerator;
  private bgIndex = 0;
  private backgrounds = ['gradient', 'white', 'light', 'light', 'white', 'light', 'white', 'white', 'light', 'white'];

  constructor() {
    this.idGen = new IDGenerator();
  }

  private getNextBackground(): { type: string; color: string; isGradient: boolean } {
    const bg = this.backgrounds[this.bgIndex % this.backgrounds.length];
    this.bgIndex++;

    if (bg === 'gradient') {
      return { type: 'gradient', color: BRAND.colors.primary, isGradient: true };
    } else if (bg === 'white') {
      return { type: 'classic', color: BRAND.colors.background_white, isGradient: false };
    } else {
      return { type: 'classic', color: BRAND.colors.background_light, isGradient: false };
    }
  }

  buildHeroSection(title: string) {
    return {
      id: this.idGen.generate("hero"),
      elType: "section",
      isInner: false,
      settings: {
        layout: "full_width",
        background_background: "gradient",
        background_color: BRAND.colors.primary,
        background_color_b: "#001a33",
        background_gradient_type: "linear",
        background_gradient_angle: { unit: "deg", size: 135 },
        padding: { unit: "px", top: "100", right: "20", bottom: "100", left: "20", isLinked: false },
        padding_mobile: { unit: "px", top: "60", right: "20", bottom: "60", left: "20", isLinked: false },
      },
      elements: [
        {
          id: this.idGen.generate("col"),
          elType: "column",
          isInner: false,
          settings: { _column_size: 100, _inline_size: null },
          elements: [
            {
              id: this.idGen.generate("h1"),
              elType: "widget",
              widgetType: "heading",
              isInner: false,
              settings: {
                title: title.replace(/\n/g, '<br>'),
                header_size: "h1",
                title_color: "#ffffff",
                typography_typography: "custom",
                typography_font_family: BRAND.typography.heading_font,
                typography_font_weight: BRAND.typography.heading_weight,
                typography_font_size: { unit: "px", size: BRAND.font_sizes.h1.desktop, sizes: [] },
                typography_font_size_mobile: { unit: "px", size: BRAND.font_sizes.h1.mobile, sizes: [] },
                align: "center",
                align_mobile: "center",
              },
              elements: [],
            },
          ],
        },
      ],
    };
  }

  buildContentSection(section: ContentSection) {
    const bg = this.getNextBackground();
    const textColor = bg.isGradient ? "#ffffff" : BRAND.colors.text_dark;
    const headingColor = bg.isGradient ? "#ffffff" : (section.level === 2 ? BRAND.colors.primary : BRAND.colors.secondary);

    const widgets: any[] = [];

    // Add heading
    widgets.push({
      id: this.idGen.generate("head"),
      elType: "widget",
      widgetType: "heading",
      isInner: false,
      settings: {
        title: section.heading,
        header_size: section.level === 2 ? "h2" : "h3",
        title_color: headingColor,
        typography_typography: "custom",
        typography_font_family: BRAND.typography.heading_font,
        typography_font_weight: BRAND.typography.heading_weight,
        typography_font_size: section.level === 2
          ? { unit: "px", size: BRAND.font_sizes.h2.desktop, sizes: [] }
          : { unit: "px", size: BRAND.font_sizes.h3.desktop, sizes: [] },
        typography_font_size_mobile: section.level === 2
          ? { unit: "px", size: BRAND.font_sizes.h2.mobile, sizes: [] }
          : { unit: "px", size: BRAND.font_sizes.h3.mobile, sizes: [] },
      },
      elements: [],
    });

    // Split content into paragraphs and lists
    const paragraphs = section.content.split('\n\n');
    let currentList: string[] = [];

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      // Check if it's a list block
      const lines = trimmed.split('\n');
      const isListBlock = lines.every(line => {
        const l = line.trim();
        return l.startsWith('*   ') || l.startsWith('- ') || l.startsWith('* ') || l.match(/^\d+\.\s/) || l === '';
      });

      if (isListBlock) {
        // Extract list items
        for (const line of lines) {
          const l = line.trim();
          if (l.startsWith('*   ')) {
            currentList.push(l.substring(4).trim());
          } else if (l.startsWith('* ')) {
            currentList.push(l.substring(2).trim());
          } else if (l.startsWith('- ')) {
            currentList.push(l.substring(2).trim());
          } else if (l.match(/^\d+\.\s/)) {
            currentList.push(l.replace(/^\d+\.\s/, '').trim());
          }
        }
      } else {
        // Flush accumulated list
        if (currentList.length > 0) {
          const iconListItems = currentList.map((item) => ({
            _id: this.idGen.generate("item"),
            text: item,
            icon: { value: "fas fa-check-circle", library: "fa-solid" },
          }));

          widgets.push({
            id: this.idGen.generate("list"),
            elType: "widget",
            widgetType: "icon-list",
            isInner: false,
            settings: {
              icon_list: iconListItems,
              icon_color: bg.isGradient ? BRAND.colors.accent : BRAND.colors.secondary,
              text_color: textColor,
              typography_typography: "custom",
              typography_font_family: BRAND.typography.body_font,
              typography_font_size: { unit: "px", size: BRAND.font_sizes.body.desktop, sizes: [] },
              typography_font_size_mobile: { unit: "px", size: BRAND.font_sizes.body.mobile, sizes: [] },
            },
            elements: [],
          });
          currentList = [];
        }

        // Add paragraph
        widgets.push({
          id: this.idGen.generate("text"),
          elType: "widget",
          widgetType: "text-editor",
          isInner: false,
          settings: {
            editor: `<p>${trimmed}</p>`,
            text_color: textColor,
            typography_typography: "custom",
            typography_font_family: BRAND.typography.body_font,
            typography_font_size: { unit: "px", size: BRAND.font_sizes.body.desktop, sizes: [] },
            typography_font_size_mobile: { unit: "px", size: BRAND.font_sizes.body.mobile, sizes: [] },
          },
          elements: [],
        });
      }
    }

    // Flush remaining list
    if (currentList.length > 0) {
      const iconListItems = currentList.map((item) => ({
        _id: this.idGen.generate("item"),
        text: item,
        icon: { value: "fas fa-check-circle", library: "fa-solid" },
      }));

      widgets.push({
        id: this.idGen.generate("list"),
        elType: "widget",
        widgetType: "icon-list",
        isInner: false,
        settings: {
          icon_list: iconListItems,
          icon_color: bg.isGradient ? BRAND.colors.accent : BRAND.colors.secondary,
          text_color: textColor,
          typography_typography: "custom",
          typography_font_family: BRAND.typography.body_font,
          typography_font_size: { unit: "px", size: BRAND.font_sizes.body.desktop, sizes: [] },
          typography_font_size_mobile: { unit: "px", size: BRAND.font_sizes.body.mobile, sizes: [] },
        },
        elements: [],
      });
    }

    return {
      id: this.idGen.generate("sec"),
      elType: "section",
      isInner: false,
      settings: {
        background_background: bg.type,
        background_color: bg.color,
        ...(bg.isGradient && {
          background_color_b: "#001a33",
          background_gradient_type: "linear",
          background_gradient_angle: { unit: "deg", size: 135 },
        }),
        padding: { unit: "px", top: "60", right: "20", bottom: "60", left: "20", isLinked: false },
        padding_mobile: { unit: "px", top: "40", right: "20", bottom: "40", left: "20", isLinked: false },
      },
      elements: [
        {
          id: this.idGen.generate("col"),
          elType: "column",
          isInner: false,
          settings: { _column_size: 100, _inline_size: null },
          elements: widgets,
        },
      ],
    };
  }

  buildFAQSection(faqs: FAQ[]) {
    if (faqs.length === 0) return null;

    const accordionItems = faqs.map((faq) => {
      const id = this.idGen.generate("faq");
      return {
        _id: id,
        accordion_title: faq.question,
        accordion_content: `<p>${faq.answer}</p>`,
      };
    });

    const tabsItems = accordionItems.map((item) => ({
      _id: item._id,
      tab_title: item.accordion_title,
      tab_content: item.accordion_content,
    }));

    return {
      id: this.idGen.generate("sec"),
      elType: "section",
      isInner: false,
      settings: {
        background_background: "classic",
        background_color: BRAND.colors.background_light,
        padding: { unit: "px", top: "60", right: "20", bottom: "60", left: "20", isLinked: false },
        padding_mobile: { unit: "px", top: "40", right: "20", bottom: "40", left: "20", isLinked: false },
      },
      elements: [
        {
          id: this.idGen.generate("col"),
          elType: "column",
          isInner: false,
          settings: { _column_size: 100, _inline_size: null },
          elements: [
            {
              id: this.idGen.generate("head"),
              elType: "widget",
              widgetType: "heading",
              isInner: false,
              settings: {
                title: "Häufig gestellte Fragen",
                header_size: "h2",
                title_color: BRAND.colors.primary,
                typography_typography: "custom",
                typography_font_family: BRAND.typography.heading_font,
                typography_font_weight: BRAND.typography.heading_weight,
                typography_font_size: { unit: "px", size: BRAND.font_sizes.h2.desktop, sizes: [] },
                typography_font_size_mobile: { unit: "px", size: BRAND.font_sizes.h2.mobile, sizes: [] },
              },
              elements: [],
            },
            {
              id: this.idGen.generate("acc"),
              elType: "widget",
              widgetType: "accordion",
              isInner: false,
              settings: {
                accordion: accordionItems,
                tabs: tabsItems,
                title_color: BRAND.colors.primary,
                content_color: BRAND.colors.text_dark,
                icon_color: BRAND.colors.secondary,
                typography_typography: "custom",
                typography_font_family: BRAND.typography.heading_font,
              },
              elements: [],
            },
          ],
        },
      ],
    };
  }

  buildCTASection() {
    return {
      id: this.idGen.generate("sec"),
      elType: "section",
      isInner: false,
      settings: {
        background_background: "gradient",
        background_color: BRAND.colors.primary,
        background_color_b: "#001a33",
        background_gradient_type: "linear",
        background_gradient_angle: { unit: "deg", size: 135 },
        padding: { unit: "px", top: "80", right: "20", bottom: "80", left: "20", isLinked: false },
        padding_mobile: { unit: "px", top: "50", right: "20", bottom: "50", left: "20", isLinked: false },
      },
      elements: [
        {
          id: this.idGen.generate("col"),
          elType: "column",
          isInner: false,
          settings: { _column_size: 100, _inline_size: null },
          elements: [
            {
              id: this.idGen.generate("head"),
              elType: "widget",
              widgetType: "heading",
              isInner: false,
              settings: {
                title: "Jetzt Beratung anfragen",
                header_size: "h2",
                title_color: "#ffffff",
                typography_typography: "custom",
                typography_font_family: BRAND.typography.heading_font,
                typography_font_weight: BRAND.typography.heading_weight,
                typography_font_size: { unit: "px", size: BRAND.font_sizes.h2.desktop, sizes: [] },
                typography_font_size_mobile: { unit: "px", size: BRAND.font_sizes.h2.mobile, sizes: [] },
                align: "center",
              },
              elements: [],
            },
            {
              id: this.idGen.generate("btn"),
              elType: "widget",
              widgetType: "button",
              isInner: false,
              settings: {
                text: "Kontakt aufnehmen",
                align: "center",
                button_background_color: BRAND.colors.secondary,
                button_text_color: "#ffffff",
                typography_typography: "custom",
                typography_font_family: BRAND.typography.heading_font,
                typography_font_size: { unit: "px", size: 18, sizes: [] },
                border_radius: { unit: "px", top: "50", right: "50", bottom: "50", left: "50", isLinked: true },
                button_padding: { unit: "px", top: "18", right: "35", bottom: "18", left: "35", isLinked: false },
                box_shadow_box_shadow_type: "yes",
                box_shadow_box_shadow: {
                  horizontal: 0,
                  vertical: 8,
                  blur: 20,
                  spread: 0,
                  color: "rgba(255,102,0,0.4)"
                },
              },
              elements: [],
            },
          ],
        },
      ],
    };
  }

  build(title: string, markdown: string, faqs: FAQ[]): any {
    const sections: any[] = [];

    // 1. Hero section
    sections.push(this.buildHeroSection(title));

    // 2. Parse markdown and build content sections
    const contentSections = parseMarkdownSections(markdown);
    console.log(`Building ${contentSections.length} content sections`);

    for (const section of contentSections) {
      sections.push(this.buildContentSection(section));
    }

    // 3. FAQ section
    if (faqs && faqs.length > 0) {
      console.log(`Adding FAQ section with ${faqs.length} questions`);
      const faqSection = this.buildFAQSection(faqs);
      if (faqSection) sections.push(faqSection);
    }

    // 4. CTA section
    sections.push(this.buildCTASection());

    return {
      content: sections,
      page_settings: { hide_title: "yes" },
      version: "0.4",
      title: title,
      type: "page",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create auth client to verify user
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await authSupabase.auth.getUser();
    if (userError || !user) {
      console.error("User authentication failed:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { articleId } = await req.json();

    if (!articleId) {
      return new Response(
        JSON.stringify({ error: "articleId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch article
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .single();

    if (articleError) {
      console.error("Article error:", articleError);
      return new Response(
        JSON.stringify({ error: "Article not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns the workspace that contains this article's project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("workspace_id")
      .eq("id", article.project_id)
      .single();

    if (projectError || !project) {
      console.error("Project not found:", projectError);
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", project.workspace_id)
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace not found:", workspaceError);
      return new Response(
        JSON.stringify({ error: "Workspace not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (workspace.owner_id !== user.id) {
      console.error("User does not own workspace");
      return new Response(
        JSON.stringify({ error: "Forbidden - not workspace owner" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== ARTICLE DATA ===");
    console.log("Title:", article.title);
    console.log("Markdown length:", article.content_markdown?.length || 0);
    console.log("FAQ count:", article.faq_json?.length || 0);
    console.log("Outline count:", article.outline_json?.length || 0);

    const title = article.title || '';
    const markdown = article.content_markdown || '';
    const faqs = article.faq_json || [];

    // Build Elementor JSON
    const builder = new ElementorBuilder();
    const elementorJson = builder.build(title, markdown, faqs);

    console.log(`=== RESULT ===`);
    console.log(`Generated ${elementorJson.content.length} total sections`);

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
        JSON.stringify({ error: "Failed to save template", details: templateError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        templateId: template.id,
        name: template.name,
        sectionsGenerated: elementorJson.content.length,
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
