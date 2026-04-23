"use node";
import { action, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import Anthropic from "@anthropic-ai/sdk";

/**
 * AI Actions (Anthropic)
 *
 * Brand analysis and design-recipe generation. Historically called Gemini
 * via an OpenAI-compat shim which 400'd on auth; migrated to Anthropic SDK
 * using claude-haiku-4-5 (sufficient for structured JSON extraction, ~80%
 * cheaper than Opus). Filename kept for backwards compat
 * (api.actions.gemini.*).
 */

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
  competitors?: Array<{
    name: string;
    domain?: string;
    strengths?: string[];
    weaknesses?: string[];
  }>;
  visual_identity?: {
    primary_color?: string;
    secondary_colors?: string[];
    logo_description?: string;
    imagery_style?: string;
  };
  internal_links?: Array<{
    url: string;
    title?: string;
    page_type?: string;
    anchor_themes?: string[];
  }>;
}

/**
 * Build the system + user prompts for brand analysis from crawled pages.
 * Ensures that Competitors, Voice details, Visual Identity, and Internal Links
 * all get populated — either from the crawled content or from Claude's
 * industry knowledge where the website itself does not spell things out.
 */
function buildBrandAnalysisPrompts(
  crawlData: Array<{
    url: string;
    title?: string;
    pageType?: string;
    contentMarkdown?: string;
    internalLinks?: string[];
    metaDescription?: string;
  }>
): { systemPrompt: string; userPrompt: string } {
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

  const pagesContent = sortedData
    .map((page) => {
      const content = (page.contentMarkdown || "").slice(0, 3500);
      return `## ${page.title || page.url}\nURL: ${page.url}\nTyp: ${page.pageType}\n${
        page.metaDescription ? `Meta: ${page.metaDescription}\n` : ""
      }\n${content}`;
    })
    .join("\n\n---\n\n");

  // Build internal-links sitemap: unique URLs with their anchor page context.
  // Limited to the first ~80 to keep the prompt lean.
  const linkPool = new Map<string, { sources: Set<string>; pageTypes: Set<string> }>();
  for (const page of sortedData) {
    for (const link of page.internalLinks ?? []) {
      if (!linkPool.has(link)) {
        linkPool.set(link, { sources: new Set(), pageTypes: new Set() });
      }
      const entry = linkPool.get(link)!;
      if (page.url) entry.sources.add(page.url);
      if (page.pageType) entry.pageTypes.add(page.pageType);
    }
  }
  const linkSummary = Array.from(linkPool.entries())
    .slice(0, 80)
    .map(
      ([url, meta]) =>
        `- ${url} (referenced from: ${Array.from(meta.pageTypes).join(", ") || "?"})`
    )
    .join("\n");

  const systemPrompt = `Du bist ein erfahrener Markenstratege und SEO-Analyst.
Deine Aufgabe: aus gecrawlten Webseiten ein vollständiges, brauchbares Markenprofil erzeugen.

Wichtige Regeln:
- Antworte AUSSCHLIESSLICH mit validem JSON. Kein Markdown, keine Code-Blöcke, keine Erklärungen.
- Leere Felder nur, wenn wirklich keine sinnvolle Antwort möglich ist.
- Für Wettbewerber: Firmen nennen fast nie ihre Konkurrenz auf der eigenen Seite. Leite 3–6 realistische Wettbewerber aus der erkennbaren Branche, Produktkategorie und Region ab. Nenne konkrete Firmen, keine Platzhalter. Ordne ihnen plausible Stärken/Schwächen relativ zur analysierten Marke zu.
- Für Visual Identity: Farbcodes stehen selten im Text. Leite die primäre Farbwelt und Bildsprache aus dem Markenkontext ab (Branche, Tonalität, Zielgruppe). Wenn du keine spezifischen Hex-Codes ableiten kannst, beschreibe die Farbwelt qualitativ (z. B. "industrielles Grau mit technischem Blau-Akzent").
- Für Voice-Writing-Style: Immer alle vier Felder (formality, sentence_length, vocabulary_level, use_of_jargon) konkret füllen, niemals "-" oder leer.
- Für Internal Links: aus der bereitgestellten Link-Liste die 8–15 thematisch wichtigsten URLs ausspielen (nicht Login, Impressum, AGB, Cookie etc.). Ergänze jeweils Titel/Page-Type/Anchor-Themes.`;

  const userPrompt = `Analysiere diese Webseiteninhalte und erstelle ein detailliertes Markenprofil.

${pagesContent}

${
  linkSummary
    ? `\n---\n\nInterne Link-Struktur (aus dem Crawl, ${linkPool.size} einzigartige URLs, davon die ersten ${Math.min(
        linkPool.size,
        80
      )} unten aufgelistet):\n${linkSummary}\n`
    : ""
}

Liefere strikt dieses JSON-Schema (alle Felder ausfüllen, außer wirklich nicht ableitbar):
{
  "brand_name": "Name der Marke/Firma",
  "tagline": "Slogan oder Kernbotschaft",
  "mission_statement": "Mission oder Vision",
  "brand_story": "Kurzform der Markengeschichte (2-3 Sätze)",
  "brand_voice": {
    "tone": ["professionell", "..."],
    "personality_traits": ["innovativ", "..."],
    "writing_style": {
      "formality": "formell | informell | gemischt",
      "sentence_length": "kurz | mittel | lang | gemischt",
      "vocabulary_level": "einfach | fachlich | gemischt",
      "use_of_jargon": "wenig | moderat | viel"
    }
  },
  "products": [{"name":"...","description":"...","features":["..."],"category":"..."}],
  "services": [{"name":"...","description":"...","target_audience":"..."}],
  "personas": [{"name":"...","demographics":"...","pain_points":["..."],"goals":["..."],"preferred_channels":["..."]}],
  "brand_keywords": {
    "primary": ["..."],
    "secondary": ["..."],
    "long_tail": ["..."]
  },
  "competitors": [
    {"name":"Konkurrent-Firmenname","domain":"konkurrent.de","strengths":["..."],"weaknesses":["..."]}
  ],
  "visual_identity": {
    "primary_color": "#... oder qualitative Beschreibung",
    "secondary_colors": ["#...", "..."],
    "logo_description": "Beschreibung des Logos / der Wortmarke",
    "imagery_style": "Bildsprache in 1-2 Sätzen"
  },
  "internal_links": [
    {"url":"https://...","title":"...","page_type":"service|product|blog|...","anchor_themes":["Keyword1","Keyword2"]}
  ]
}`;

  return { systemPrompt, userPrompt };
}

/**
 * Call Anthropic API (Claude Opus 4.7).
 *
 * The third parameter is kept as a string for call-site compatibility —
 * legacy code passes a Gemini model name here (e.g. "gemini-2.0-flash").
 * It is now ignored; the hardcoded model is claude-opus-4-7.
 */
async function callGemini(
  prompt: string,
  systemPrompt?: string,
  _legacyModel?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }
  return textBlock.text;
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
        limit: 30,
      });

      if (crawlData.length === 0) {
        return { success: false, error: "No crawl data available for analysis" };
      }

      const { systemPrompt, userPrompt } = buildBrandAnalysisPrompts(crawlData);
      const response = await callGemini(userPrompt, systemPrompt);

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
        competitors: analysis.competitors,
        visualIdentity: analysis.visual_identity,
        internalLinks: analysis.internal_links,
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
 * Internal action for automated analysis (scheduled by the Jina crawler action)
 */
export const analyzeBrandInternal = internalAction({
  args: {
    brandProfileId: v.id("brandProfiles"),
  },
  handler: async (ctx, { brandProfileId }) => {
    // Get brand profile (internal query — no auth needed for scheduled action)
    const brandProfile = await ctx.runQuery(internal.tables.brandProfiles.getInternal, {
      id: brandProfileId,
    });

    if (!brandProfile) {
      console.error("Brand profile not found:", brandProfileId);
      return;
    }

    // Get top crawled pages (internal query)
    const crawlData = await ctx.runQuery(internal.tables.brandCrawlData.getTopByRelevanceInternal, {
      brandProfileId,
      limit: 30,
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
      const { systemPrompt, userPrompt } = buildBrandAnalysisPrompts(crawlData);
      const response = await callGemini(userPrompt, systemPrompt);

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
          competitors: analysis.competitors,
          visualIdentity: analysis.visual_identity,
          internalLinks: analysis.internal_links,
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
