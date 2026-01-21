import { inngest } from "../../client";
import { convex, api, AGENT_CREDITS, calculateCostCents } from "../../lib/convex";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Internal Linker Agent
 *
 * Analyzes article content and suggests internal links based on
 * semantic relevance to other articles in the project.
 *
 * Input: Article ID (triggered after article/published event)
 * Output: Link suggestions saved to article metadata
 *
 * Cost: 5 credits
 */

const AGENT_ID = "internal-linker";
const CREDITS_REQUIRED = AGENT_CREDITS[AGENT_ID];

const SYSTEM_PROMPT = `Du bist ein SEO-Experte für interne Verlinkung. Analysiere den Artikel und schlage interne Links vor.

## Regeln für interne Links:
1. Nur semantisch relevante Links vorschlagen
2. Natürliche Anchor-Texte verwenden (keine "hier klicken")
3. Links früh im Text platzieren (mehr SEO-Wert)
4. Max 5-7 interne Links pro Artikel
5. Pillar Pages sollten häufiger verlinkt werden
6. Cluster-Artikel untereinander verlinken

## Anchor-Text Best Practices:
- Beschreibend und keyword-relevant
- Natürlich im Satzfluss
- Varianten verwenden (nicht immer gleicher Text)
- Nicht zu lang (2-5 Wörter optimal)

## Output Format (JSON):
{
  "suggestions": [
    {
      "anchorText": "natürlicher Anchor-Text im Artikel",
      "targetArticleId": "id-des-zielartikels",
      "targetTitle": "Titel des Zielartikels",
      "relevanceScore": 0.85,
      "contextSentence": "Der komplette Satz wo der Link eingefügt werden soll",
      "reason": "Begründung warum dieser Link sinnvoll ist"
    }
  ],
  "analysis": {
    "topicCoverage": "Wie gut deckt der Artikel das Thema ab",
    "suggestedTopics": ["Themen die noch fehlen könnten"],
    "linkingOpportunities": 5
  }
}`;

interface LinkSuggestion {
  anchorText: string;
  targetArticleId: string;
  targetTitle: string;
  relevanceScore: number;
  contextSentence: string;
  reason: string;
}

interface LinkAnalysis {
  suggestions: LinkSuggestion[];
  analysis: {
    topicCoverage: string;
    suggestedTopics: string[];
    linkingOpportunities: number;
  };
}

export const internalLinker = inngest.createFunction(
  {
    id: "internal-linker",
    name: "Internal Linker",
    concurrency: {
      limit: 5,
      key: "event.data.customerId",
    },
    retries: 2,
  },
  { event: "article/published" },
  async ({ event, step }) => {
    const { articleId, projectId, userId, customerId, workspaceId, contentMarkdown, primaryKeyword } =
      event.data as {
        articleId: string;
        projectId: string;
        userId: string;
        customerId: string;
        workspaceId: string;
        contentMarkdown?: string;
        primaryKeyword?: string;
      };

    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    // Step 1: Check and reserve credits
    await step.run("check-credits", async () => {
      const result = await convex.action(api.agents.actions.checkAndReserveCredits, {
        workspaceId,
        agentId: AGENT_ID,
        requiredCredits: CREDITS_REQUIRED,
      });

      if (!result.success) {
        throw new Error(result.error || "Credit check failed");
      }
    });

    // Step 2: Create job record
    await step.run("create-job-record", async () => {
      await convex.action(api.agents.actions.createAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        userId,
        workspaceId,
        projectId,
        agentId: AGENT_ID,
        eventType: "article/published",
        inputData: { articleId },
        creditsReserved: CREDITS_REQUIRED,
      });
    });

    // Step 3: Fetch all project articles for link analysis
    const projectData = await step.run("fetch-project-articles", async () => {
      // Get current article if content not provided in event
      let article = null;
      if (!contentMarkdown) {
        article = await convex.action(api.agents.actions.getArticle, { articleId });
      }

      // Get all articles in project
      const articles = await convex.action(api.agents.actions.getProjectArticles, {
        projectId,
      });

      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        status: "running",
        currentStep: "Analyzing project articles",
        progress: 20,
      });

      return {
        currentArticle: {
          id: articleId,
          content: contentMarkdown || article?.contentMarkdown || "",
          keyword: primaryKeyword || article?.primaryKeyword || "",
        },
        otherArticles: articles.filter((a) => a._id !== articleId),
      };
    });

    // Step 4: Analyze and generate link suggestions
    const linkAnalysis = await step.run("analyze-links", async () => {
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        currentStep: "Generating link suggestions",
        progress: 40,
      });

      // Skip if no other articles to link to
      if (projectData.otherArticles.length === 0) {
        return {
          suggestions: [],
          analysis: {
            topicCoverage: "Erste Artikel im Projekt - keine internen Links möglich",
            suggestedTopics: [],
            linkingOpportunities: 0,
          },
        };
      }

      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const articlesContext = projectData.otherArticles
        .map(
          (a) =>
            `- ID: ${a._id}\n  Titel: "${a.title}"\n  Keyword: "${a.primaryKeyword || "nicht definiert"}"`
        )
        .join("\n\n");

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Analysiere diesen Artikel und schlage interne Links zu anderen Artikeln im Projekt vor.

**Aktueller Artikel:**
Keyword: ${projectData.currentArticle.keyword}

Content (erste 4000 Zeichen):
${projectData.currentArticle.content.substring(0, 4000)}

---

**Verfügbare Artikel für Verlinkung:**
${articlesContext}

---

Gib deine Link-Vorschläge im JSON-Format zurück. Achte auf semantische Relevanz und natürliche Anchor-Texte.`,
          },
        ],
      });

      inputTokens = response.usage.input_tokens;
      outputTokens = response.usage.output_tokens;

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response");
      }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          suggestions: [],
          analysis: {
            topicCoverage: "Konnte nicht analysiert werden",
            suggestedTopics: [],
            linkingOpportunities: 0,
          },
        };
      }

      return JSON.parse(jsonMatch[0]) as LinkAnalysis;
    });

    // Step 5: Save link suggestions to content asset
    await step.run("save-suggestions", async () => {
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        currentStep: "Saving suggestions",
        progress: 80,
      });

      if (linkAnalysis.suggestions.length > 0) {
        await convex.action(api.agents.actions.createContentAsset, {
          projectId,
          articleId,
          assetType: "internal_links",
          title: "Internal Link Suggestions",
          content: JSON.stringify(linkAnalysis.suggestions, null, 2),
          contentJson: linkAnalysis,
          metadata: {
            suggestionsCount: linkAnalysis.suggestions.length,
            analysis: linkAnalysis.analysis,
          },
          status: "draft",
        });
      }
    });

    // Step 6: Log usage
    const durationMs = Date.now() - startTime;
    await step.run("log-usage", async () => {
      await convex.action(api.agents.actions.logUsage, {
        userId,
        workspaceId,
        projectId,
        agentId: AGENT_ID,
        jobId: event.id,
        creditsUsed: CREDITS_REQUIRED,
        inputTokens,
        outputTokens,
        articleId,
        status: "completed",
        durationMs,
      });

      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        status: "completed",
        progress: 100,
        currentStep: "Done",
        creditsUsed: CREDITS_REQUIRED,
        result: {
          suggestionsCount: linkAnalysis.suggestions.length,
          analysis: linkAnalysis.analysis,
        },
      });
    });

    return {
      success: true,
      articleId,
      suggestionsCount: linkAnalysis.suggestions.length,
      analysis: linkAnalysis.analysis,
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
