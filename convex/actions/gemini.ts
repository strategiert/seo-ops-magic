"use node";
import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

/**
 * Gemini AI Actions
 *
 * Brand analysis and content generation using Google Gemini API.
 * Converted from supabase/functions/brand-analyze/index.ts
 */

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

interface BrandAnalysis {
  brand_name?: string;
  tagline?: string;
  mission_statement?: string;
  brand_story?: string;
  brand_voice?: {
    tone: string[];
    personality_traits: string[];
    writing_style: {
      formality?: string;
      sentence_length?: string;
      vocabulary_level?: string;
      use_of_jargon?: string;
    };
  };
  products?: Array<{
    name: string;
    description: string;
    price?: string;
    features: string[];
    category?: string;
  }>;
  services?: Array<{
    name: string;
    description: string;
    pricing_model?: string;
    target_audience?: string;
  }>;
  personas?: Array<{
    name: string;
    demographics: string;
    pain_points: string[];
    goals: string[];
    preferred_channels: string[];
  }>;
  brand_keywords?: {
    primary: string[];
    secondary: string[];
    long_tail: string[];
  };
  visual_identity?: {
    primary_color?: string;
    secondary_colors?: string[];
    logo_description?: string;
    imagery_style?: string;
  };
}

/**
 * Get Gemini API key
 */
function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  return apiKey;
}

/**
 * Call Gemini API
 */
async function callGemini(
  prompt: string,
  systemPrompt?: string,
  model: string = "gemini-2.0-flash"
): Promise<string> {
  const apiKey = getGeminiApiKey();

  const messages: Array<{ role: string; content: string }> = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Analyze brand from crawled data (public action)
 */
export const analyzeBrand = action({
  args: {
    projectId: v.id("projects"),
    brandProfileId: v.id("brandProfiles"),
  },
  handler: async (ctx, { projectId, brandProfileId }): Promise<{
    success: boolean;
    brandProfileId?: string;
    analysis?: {
      brand_name?: string;
      products_count?: number;
      services_count?: number;
      personas_count?: number;
      keywords_count?: number;
    };
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify access
    const project = await ctx.runQuery(api.tables.projects.get, { id: projectId });
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    const brandProfile = await ctx.runQuery(api.tables.brandProfiles.get, {
      id: brandProfileId,
    });
    if (!brandProfile) {
      return { success: false, error: "Brand profile not found" };
    }

    // Update status
    await ctx.runMutation(api.tables.brandProfiles.updateCrawlStatus, {
      id: brandProfileId,
      crawlStatus: "analyzing",
    });

    try {
      // Get top crawled pages
      const crawlData = await ctx.runQuery(api.tables.brandCrawlData.getTopByRelevance, {
        brandProfileId,
        limit: 15,
      });

      if (crawlData.length === 0) {
        return { success: false, error: "No crawl data available for analysis" };
      }

      // Sort pages by type priority
      const typeOrder = [
        "homepage",
        "about",
        "service",
        "product",
        "pricing",
        "team",
        "contact",
        "blog",
        "other",
      ];
      const sortedData = [...crawlData].sort(
        (a, b) =>
          typeOrder.indexOf(a.pageType || "other") -
          typeOrder.indexOf(b.pageType || "other")
      );

      // Build analysis prompt
      const pagesContent = sortedData
        .map((page) => {
          const content = (page.contentMarkdown || "").slice(0, 3000);
          return `## ${page.title || page.url}\nURL: ${page.url}\nTyp: ${page.pageType}\n\n${content}`;
        })
        .join("\n\n---\n\n");

      const systemPrompt = `Du bist ein Markenexperte, der Webseiteninhalte analysiert, um ein umfassendes Markenprofil zu erstellen.
Analysiere die bereitgestellten Webseiteninhalte und extrahiere strukturierte Markeninformationen.
Antworte AUSSCHLIESSLICH mit validem JSON ohne Markdown-Codeblöcke.`;

      const userPrompt = `Analysiere diese Webseiteninhalte und erstelle ein detailliertes Markenprofil:

${pagesContent}

Extrahiere folgende Informationen als JSON:
{
  "brand_name": "Name der Marke/Firma",
  "tagline": "Slogan oder Kernbotschaft",
  "mission_statement": "Mission oder Vision",
  "brand_story": "Kurzform der Markengeschichte (2-3 Sätze)",
  "brand_voice": {
    "tone": ["professionell", "freundlich", ...],
    "personality_traits": ["innovativ", "zuverlässig", ...],
    "writing_style": {
      "formality": "formell/informell/gemischt",
      "sentence_length": "kurz/mittel/lang",
      "vocabulary_level": "einfach/fachlich/gemischt",
      "use_of_jargon": "wenig/moderat/viel"
    }
  },
  "products": [{"name": "...", "description": "...", "features": [...], "category": "..."}],
  "services": [{"name": "...", "description": "...", "target_audience": "..."}],
  "personas": [{"name": "...", "demographics": "...", "pain_points": [...], "goals": [...]}],
  "brand_keywords": {
    "primary": ["Hauptkeyword1", ...],
    "secondary": ["Nebenkeyword1", ...],
    "long_tail": ["Langes Keyword 1", ...]
  },
  "visual_identity": {
    "primary_color": "#...",
    "secondary_colors": ["#...", ...],
    "logo_description": "...",
    "imagery_style": "..."
  }
}`;

      const response = await callGemini(userPrompt, systemPrompt, "gemini-2.0-flash");

      // Parse JSON response
      let analysis: BrandAnalysis;
      try {
        // Remove markdown code blocks if present
        let jsonStr = response
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        analysis = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Failed to parse Gemini response:", parseError);
        return { success: false, error: "Failed to parse analysis response" };
      }

      // Update brand profile with analysis
      await ctx.runMutation(api.tables.brandProfiles.updateAnalysis, {
        id: brandProfileId,
        brandName: analysis.brand_name,
        tagline: analysis.tagline,
        missionStatement: analysis.mission_statement,
        brandStory: analysis.brand_story,
        brandVoice: analysis.brand_voice,
        products: analysis.products,
        services: analysis.services,
        personas: analysis.personas,
        brandKeywords: analysis.brand_keywords,
        visualIdentity: analysis.visual_identity,
        crawlStatus: "completed",
      });

      return {
        success: true,
        brandProfileId: brandProfileId,
        analysis: {
          brand_name: analysis.brand_name,
          products_count: analysis.products?.length ?? 0,
          services_count: analysis.services?.length ?? 0,
          personas_count: analysis.personas?.length ?? 0,
          keywords_count:
            (analysis.brand_keywords?.primary?.length ?? 0) +
            (analysis.brand_keywords?.secondary?.length ?? 0),
        },
      };
    } catch (error) {
      console.error("Error analyzing brand:", error);

      await ctx.runMutation(api.tables.brandProfiles.updateCrawlStatus, {
        id: brandProfileId,
        crawlStatus: "error",
        crawlError: error instanceof Error ? error.message : "Analysis failed",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Analysis failed",
      };
    }
  },
});

/**
 * Internal action for automated analysis (called from firecrawl webhook)
 */
export const analyzeBrandInternal = internalAction({
  args: {
    brandProfileId: v.id("brandProfiles"),
  },
  handler: async (ctx, { brandProfileId }) => {
    // Get brand profile
    const brandProfile = await ctx.runQuery(api.tables.brandProfiles.get, {
      id: brandProfileId,
    });

    if (!brandProfile) {
      console.error("Brand profile not found:", brandProfileId);
      return;
    }

    // Get top crawled pages
    const crawlData = await ctx.runQuery(api.tables.brandCrawlData.getTopByRelevance, {
      brandProfileId,
      limit: 15,
    });

    if (crawlData.length === 0) {
      await ctx.runMutation(internal.tables.brandProfiles.internalUpdate, {
        id: brandProfileId,
        updates: {
          crawlStatus: "error",
          crawlError: "No crawl data available",
        },
      });
      return;
    }

    try {
      // Sort by type priority
      const typeOrder = [
        "homepage",
        "about",
        "service",
        "product",
        "pricing",
        "team",
        "contact",
        "blog",
        "other",
      ];
      const sortedData = [...crawlData].sort(
        (a, b) =>
          typeOrder.indexOf(a.pageType || "other") -
          typeOrder.indexOf(b.pageType || "other")
      );

      // Build prompt (same as public action)
      const pagesContent = sortedData
        .map((page) => {
          const content = (page.contentMarkdown || "").slice(0, 3000);
          return `## ${page.title || page.url}\nURL: ${page.url}\nTyp: ${page.pageType}\n\n${content}`;
        })
        .join("\n\n---\n\n");

      const systemPrompt = `Du bist ein Markenexperte, der Webseiteninhalte analysiert.
Antworte AUSSCHLIESSLICH mit validem JSON ohne Markdown-Codeblöcke.`;

      const userPrompt = `Analysiere diese Webseiteninhalte und erstelle ein Markenprofil als JSON:

${pagesContent}

JSON-Struktur:
{
  "brand_name": "...",
  "tagline": "...",
  "mission_statement": "...",
  "brand_story": "...",
  "brand_voice": {"tone": [], "personality_traits": [], "writing_style": {}},
  "products": [],
  "services": [],
  "personas": [],
  "brand_keywords": {"primary": [], "secondary": [], "long_tail": []},
  "visual_identity": {}
}`;

      const response = await callGemini(userPrompt, systemPrompt, "gemini-2.0-flash");

      // Parse response
      let analysis: BrandAnalysis;
      try {
        let jsonStr = response
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        analysis = JSON.parse(jsonStr);
      } catch {
        throw new Error("Failed to parse analysis response");
      }

      // Update profile
      await ctx.runMutation(internal.tables.brandProfiles.internalUpdate, {
        id: brandProfileId,
        updates: {
          brandName: analysis.brand_name,
          tagline: analysis.tagline,
          missionStatement: analysis.mission_statement,
          brandStory: analysis.brand_story,
          brandVoice: analysis.brand_voice,
          products: analysis.products,
          services: analysis.services,
          personas: analysis.personas,
          brandKeywords: analysis.brand_keywords,
          visualIdentity: analysis.visual_identity,
          crawlStatus: "completed",
          lastAnalysisAt: Date.now(),
        },
      });
    } catch (error) {
      console.error("Internal brand analysis error:", error);
      await ctx.runMutation(internal.tables.brandProfiles.internalUpdate, {
        id: brandProfileId,
        updates: {
          crawlStatus: "error",
          crawlError: error instanceof Error ? error.message : "Analysis failed",
        },
      });
    }
  },
});

/**
 * Generate design recipe for an article
 */
export const generateDesignRecipe = action({
  args: {
    articleId: v.id("articles"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { articleId, force = false }): Promise<{
    success: boolean;
    recipe?: any;
    provider?: string;
    cached?: boolean;
    recipeId?: string;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Unauthorized" };
    }

    // Get article
    const article = await ctx.runQuery(api.tables.articles.get, { id: articleId });
    if (!article) {
      return { success: false, error: "Article not found" };
    }

    // Check for existing recipe
    if (!force) {
      const existingRecipes = await ctx.runQuery(
        api.tables.articleDesignRecipes.getByArticle,
        { articleId }
      );
      if (existingRecipes.length > 0) {
        return {
          success: true,
          recipe: existingRecipes[0].recipeJson,
          provider: existingRecipes[0].provider || "cached",
          cached: true,
          recipeId: existingRecipes[0]._id,
        };
      }
    }

    try {
      // Generate recipe with LLM
      const content = article.contentMarkdown || article.contentHtml || "";

      const systemPrompt = `Du bist ein Layout-Designer, der Designentscheidungen für Artikel trifft.
Analysiere den Inhalt und erstelle ein Design-Rezept als JSON.
Antworte NUR mit validem JSON ohne Markdown-Codeblöcke.`;

      const userPrompt = `Erstelle ein Design-Rezept für diesen Artikel:

Titel: ${article.title}
Keyword: ${article.primaryKeyword || ""}

Inhalt (gekürzt):
${content.slice(0, 5000)}

JSON-Format:
{
  "recipeVersion": "v1",
  "theme": "editorial-bold" | "minimal-clean" | "tech-neon",
  "toc": true/false,
  "layout": [
    {"blockId": "intro", "component": "hero", "variant": "centered"},
    {"blockId": "section-1", "component": "text", "variant": "default"},
    ...
  ]
}

Wähle passende Komponenten: hero, text, list, quote, image, table, faq, cta
Varianten: default, centered, highlight, split, grid`;

      const response = await callGemini(userPrompt, systemPrompt, "gemini-2.0-flash");

      // Parse recipe
      let recipe: any;
      try {
        let jsonStr = response
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        recipe = JSON.parse(jsonStr);
      } catch {
        // Fallback recipe
        recipe = {
          recipeVersion: "v1",
          theme: "editorial-bold",
          toc: true,
          layout: [
            { blockId: "intro", component: "hero", variant: "centered" },
            { blockId: "content", component: "text", variant: "default" },
            { blockId: "faq", component: "faq", variant: "accordion" },
          ],
        };
      }

      // Save recipe
      const recipeId = await ctx.runMutation(api.tables.articleDesignRecipes.upsert, {
        articleId,
        recipeJson: recipe,
        recipeVersion: recipe.recipeVersion || "v1",
        provider: "gemini",
      });

      return {
        success: true,
        recipe,
        provider: "gemini",
        cached: false,
        recipeId,
      };
    } catch (error) {
      console.error("Error generating design recipe:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate recipe",
      };
    }
  },
});
