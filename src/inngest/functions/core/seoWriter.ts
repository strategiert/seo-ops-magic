import { inngest } from "../../client";
import { convex, api, AGENT_CREDITS, calculateCostCents } from "../../lib/convex";
import Anthropic from "@anthropic-ai/sdk";

/**
 * SEO Content Writer Agent
 *
 * Creates SEO-optimized pillar content based on NeuronWriter briefs.
 * Fully integrated with Convex for data persistence and credit management.
 *
 * Input: Content Brief ID with keywords, search intent, target audience
 * Output: Complete article with markdown content, meta tags, and SEO analysis
 *
 * Cost: 10 credits
 */

const AGENT_ID = "seo-writer";
const CREDITS_REQUIRED = AGENT_CREDITS[AGENT_ID];

const SYSTEM_PROMPT = `Du bist ein erfahrener SEO Content Writer. Deine Aufgabe ist es, hochwertige, SEO-optimierte Artikel zu erstellen.

## Deine Kernkompetenzen:
- Keyword-Integration (natürlich, nicht stuffed, 1-2% Density)
- Struktur-Optimierung (klare H1/H2/H3 Hierarchie)
- Lesbarkeit (kurze Sätze, aktive Sprache, Flesch-Index 60+)
- E-E-A-T Signale (Expertise, Erfahrung, Autorität, Vertrauen)

## Content-Struktur:
1. Hook + Keyword in ersten 100 Wörtern
2. "Was ist [Thema]?" Abschnitt
3. Hauptteile mit H2/H3
4. Praxisbeispiele
5. FAQ Abschnitt (für Schema Markup)
6. Fazit mit CTA

## Keyword-Platzierung:
- Title Tag: Keyword am Anfang
- H1: Keyword enthalten
- 2-3 H2s mit Keyword-Variationen
- Meta Description: Keyword + CTA

## Output:
Antworte IMMER im folgenden JSON-Format:
{
  "title": "SEO-optimierter Titel",
  "slug": "seo-url-slug",
  "metaTitle": "Title Tag für Google (max 60 Zeichen)",
  "metaDescription": "Meta Description (max 155 Zeichen)",
  "contentMarkdown": "# Vollständiger Artikel in Markdown...",
  "outline": [
    {"level": "h2", "text": "Überschrift"},
    {"level": "h3", "text": "Unterüberschrift"}
  ],
  "faq": [
    {"question": "Frage?", "answer": "Antwort"}
  ],
  "seoAnalysis": {
    "wordCount": 2500,
    "readingTime": "12 min",
    "keywordDensity": "1.5%",
    "h2Count": 6,
    "h3Count": 12
  }
}`;

interface ArticleOutput {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  contentMarkdown: string;
  outline: { level: string; text: string }[];
  faq: { question: string; answer: string }[];
  seoAnalysis: {
    wordCount: number;
    readingTime: string;
    keywordDensity: string;
    h2Count: number;
    h3Count: number;
  };
}

export const seoContentWriter = inngest.createFunction(
  {
    id: "seo-content-writer",
    name: "SEO Content Writer",
    concurrency: {
      limit: 3,
      key: "event.data.customerId",
    },
    retries: 3,
  },
  { event: "article/generate" },
  async ({ event, step }) => {
    const { briefId, projectId, userId, customerId, workspaceId } = event.data as {
      briefId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
    };

    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    // Step 1: Check and reserve credits
    const creditCheck = await step.run("check-credits", async () => {
      const result = await convex.action(api.agents.actions.checkAndReserveCredits, {
        workspaceId,
        agentId: AGENT_ID,
        requiredCredits: CREDITS_REQUIRED,
      });

      if (!result.success) {
        throw new Error(result.error || "Credit check failed");
      }

      return result;
    });

    // Step 2: Create agent job record for tracking
    await step.run("create-job-record", async () => {
      await convex.action(api.agents.actions.createAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        userId,
        workspaceId,
        projectId,
        agentId: AGENT_ID,
        eventType: "article/generate",
        inputData: { briefId },
        creditsReserved: CREDITS_REQUIRED,
      });
    });

    // Step 3: Fetch brief data from Convex
    const brief = await step.run("fetch-brief", async () => {
      const briefData = await convex.action(api.agents.actions.getBrief, {
        briefId,
      });

      if (!briefData) {
        throw new Error(`Brief not found: ${briefId}`);
      }

      // Update job status
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        status: "running",
        currentStep: "Fetching brief data",
        progress: 10,
      });

      return briefData;
    });

    // Step 4: Generate article with Claude
    const article = await step.run("generate-article", async () => {
      // Update job progress
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        currentStep: "Generating article with AI",
        progress: 30,
      });

      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      // Build context from brief and project defaults
      const language = brief.project?.defaultLanguage || "de";
      const tonality = brief.tonality || brief.project?.defaultTonality || "professionell, aber zugänglich";
      const targetAudience = brief.targetAudience || brief.project?.defaultTargetAudience || "Allgemein";
      const searchIntent = brief.searchIntent || "informational";
      const targetLength = brief.targetLength || 2500;

      // Extract questions from NeuronWriter guidelines if available
      const nwGuidelines = brief.nwGuidelines as { questions?: string[] } | null;
      const questions = nwGuidelines?.questions || [];

      const userPrompt = `Erstelle einen SEO-optimierten Artikel mit folgenden Vorgaben:

**Primary Keyword:** ${brief.primaryKeyword}
**Search Intent:** ${searchIntent}
**Zielgruppe:** ${targetAudience}
**Ziel-Wortanzahl:** ${targetLength} Wörter
**Sprache:** ${language === "de" ? "Deutsch" : language}
**Tonalität:** ${tonality}

${questions.length > 0 ? `**Fragen für FAQ:**\n${questions.map((q: string) => `- ${q}`).join("\n")}` : ""}

${brief.notes ? `**Zusätzliche Hinweise:**\n${brief.notes}` : ""}

Erstelle einen vollständigen, publikationsreifen Artikel im JSON-Format.`;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      // Track token usage
      inputTokens = response.usage.input_tokens;
      outputTokens = response.usage.output_tokens;

      // Extract text content
      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response from Claude");
      }

      // Parse JSON response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse JSON from response");
      }

      const articleData: ArticleOutput = JSON.parse(jsonMatch[0]);
      return articleData;
    });

    // Step 5: Save article to Convex
    const savedArticle = await step.run("save-article", async () => {
      // Update job progress
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        currentStep: "Saving article",
        progress: 80,
      });

      const result = await convex.action(api.agents.actions.createArticle, {
        projectId,
        briefId,
        title: article.title,
        primaryKeyword: brief.primaryKeyword,
        contentMarkdown: article.contentMarkdown,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        outlineJson: article.outline,
        faqJson: article.faq,
        status: "draft",
      });

      return result;
    });

    // Step 6: Update brief status to completed
    await step.run("update-brief-status", async () => {
      await convex.action(api.agents.actions.updateBriefStatus, {
        briefId,
        status: "completed",
      });
    });

    // Step 7: Log usage and finalize
    const durationMs = Date.now() - startTime;
    await step.run("log-usage", async () => {
      // Log detailed usage
      await convex.action(api.agents.actions.logUsage, {
        userId,
        workspaceId,
        projectId,
        agentId: AGENT_ID,
        jobId: event.id,
        creditsUsed: CREDITS_REQUIRED,
        inputTokens,
        outputTokens,
        articleId: savedArticle.articleId,
        briefId,
        status: "completed",
        durationMs,
      });

      // Update job as completed
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        status: "completed",
        progress: 100,
        currentStep: "Done",
        creditsUsed: CREDITS_REQUIRED,
        result: {
          articleId: savedArticle.articleId,
          title: article.title,
          wordCount: article.seoAnalysis.wordCount,
        },
      });
    });

    return {
      success: true,
      articleId: savedArticle.articleId,
      title: article.title,
      wordCount: article.seoAnalysis.wordCount,
      creditsUsed: CREDITS_REQUIRED,
      durationMs,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostCents: calculateCostCents(inputTokens, outputTokens),
      },
    };
  }
);
