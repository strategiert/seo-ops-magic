import { inngest } from "../../client";
import { convex, api, AGENT_CREDITS, calculateCostCents } from "../../lib/convex";
import Anthropic from "@anthropic-ai/sdk";

/**
 * HTML Designer Agent
 *
 * Transforms Markdown content into styled HTML with Tailwind CSS.
 * Creates visually appealing, responsive layouts.
 *
 * Input: Article ID
 * Output: Styled HTML saved to article.contentHtml
 *
 * Cost: 3 credits
 */

const AGENT_ID = "html-designer";
const CREDITS_REQUIRED = AGENT_CREDITS[AGENT_ID];

const SYSTEM_PROMPT = `Du bist ein HTML/CSS Designer Experte. Transformiere Markdown-Content in wunderschönes, responsives HTML mit Tailwind CSS.

## Design-Prinzipien:
- Clean, modernes Design
- Gute Lesbarkeit (Typografie, Whitespace)
- Responsive (Mobile-first)
- Accessibility (semantische HTML Tags)

## Tailwind Klassen:
- Container: max-w-4xl mx-auto px-4 py-8
- Überschriften H1: text-4xl font-bold text-gray-900 mb-6
- Überschriften H2: text-2xl font-semibold text-gray-800 mt-10 mb-4
- Überschriften H3: text-xl font-medium text-gray-700 mt-6 mb-3
- Absätze: text-lg text-gray-600 leading-relaxed mb-4
- Listen UL: list-disc pl-6 space-y-2 text-gray-600
- Listen OL: list-decimal pl-6 space-y-2 text-gray-600
- Zitate: border-l-4 border-blue-500 pl-4 py-2 italic text-gray-700 bg-blue-50 my-6
- Code inline: bg-gray-100 rounded px-2 py-1 font-mono text-sm
- Code block: bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto my-6
- Bilder: rounded-lg shadow-md my-6 w-full
- Links: text-blue-600 hover:text-blue-800 underline
- FAQ Section: bg-gray-50 rounded-lg p-6 my-8
- CTA Button: inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium

## FAQ Schema Markup:
Wrap FAQ sections in proper schema.org markup for SEO.

## Output:
Gib NUR den HTML-Code zurück, ohne Markdown-Codeblocks oder Erklärungen. Das HTML sollte direkt verwendbar sein.`;

export const htmlDesigner = inngest.createFunction(
  {
    id: "html-designer",
    name: "HTML Designer",
    concurrency: {
      limit: 5,
      key: "event.data.customerId",
    },
    retries: 3,
  },
  { event: "article/transform-html" },
  async ({ event, step }) => {
    const { articleId, projectId, userId, customerId, workspaceId } = event.data as {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
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
        eventType: "article/transform-html",
        inputData: { articleId },
        creditsReserved: CREDITS_REQUIRED,
      });
    });

    // Step 3: Fetch article
    const article = await step.run("fetch-article", async () => {
      const articleData = await convex.action(api.agents.actions.getArticle, {
        articleId,
      });

      if (!articleData) {
        throw new Error(`Article not found: ${articleId}`);
      }

      if (!articleData.contentMarkdown) {
        throw new Error("Article has no markdown content");
      }

      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        status: "running",
        currentStep: "Fetching article",
        progress: 10,
      });

      return articleData;
    });

    // Step 4: Transform to HTML
    const html = await step.run("transform-html", async () => {
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        currentStep: "Transforming to HTML",
        progress: 30,
      });

      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Transformiere diesen Markdown-Artikel in styled HTML mit Tailwind CSS:

**Titel:** ${article.title}

**Content:**
${article.contentMarkdown}

${article.faqJson ? `**FAQ (für Schema Markup):**\n${JSON.stringify(article.faqJson, null, 2)}` : ""}

Gib nur den HTML-Code zurück.`,
          },
        ],
      });

      inputTokens = response.usage.input_tokens;
      outputTokens = response.usage.output_tokens;

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response");
      }

      // Clean up the response - remove any markdown code blocks
      let htmlContent = textContent.text;
      htmlContent = htmlContent.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "");

      return htmlContent.trim();
    });

    // Step 5: Save HTML to article
    await step.run("save-html", async () => {
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        currentStep: "Saving HTML",
        progress: 80,
      });

      await convex.action(api.agents.actions.updateArticle, {
        articleId,
        contentHtml: html,
      });
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
        result: { htmlLength: html.length },
      });
    });

    return {
      success: true,
      articleId,
      htmlLength: html.length,
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
