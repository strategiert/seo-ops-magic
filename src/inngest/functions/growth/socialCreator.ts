import { inngest } from "../../client.js";
import { convex, api, AGENT_CREDITS, calculateCostCents } from "../../lib/convex.js";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Social Post Creator Agent
 *
 * Creates platform-specific social media posts from article content.
 * Handles LinkedIn, Twitter/X, Instagram, and Facebook formats.
 *
 * Input: Article ID and target platforms
 * Output: Multiple social posts per platform saved as content assets
 *
 * Cost: 5 credits
 */

const AGENT_ID = "social-creator";
const CREDITS_REQUIRED = AGENT_CREDITS[AGENT_ID];

const SYSTEM_PROMPT = `Du bist ein Social Media Experte. Erstelle plattformspezifische Posts aus Artikelinhalten.

## Plattform-Spezifikationen:

### LinkedIn
- Länge: 1300-3000 Zeichen
- Ton: Professionell, thought leadership
- Format: Hook → Story/Insight → Key Takeaways → CTA
- Hashtags: 3-5 relevante am Ende
- Emojis: Sparsam, professionell (📊 💡 ✅)

### Twitter/X
- Länge: Max 280 Zeichen pro Tweet (oder Thread mit 3-5 Tweets)
- Ton: Direkt, knackig, conversational
- Format: Hook + Key Point + CTA
- Hashtags: 1-2 max
- Emojis: Erlaubt für Aufmerksamkeit

### Instagram
- Caption: 150-2200 Zeichen
- Ton: Persönlich, authentisch, storytelling
- Format: Hook → Value → CTA → Hashtags in neuem Absatz
- Hashtags: 15-20 relevante (mix aus groß und nische)
- Emojis: Großzügig verwenden

### Facebook
- Länge: 100-500 Zeichen optimal
- Ton: Conversational, community-fokussiert
- Format: Question/Hook → Content → Engagement CTA
- Hashtags: 1-3 max
- Emojis: Moderat

## Post-Typen pro Plattform:
1. Company Voice - Offizieller Unternehmenskanal
2. Personal/Employee - Für Mitarbeiter-Sharing (authentischer, persönlicher)

## Output Format (JSON):
{
  "posts": [
    {
      "platform": "linkedin",
      "accountType": "company",
      "content": "Post-Text mit Formatierung...",
      "hashtags": ["marketing", "seo", "contentmarketing"],
      "suggestedImagePrompt": "Beschreibung für AI-Bildgenerierung",
      "bestPostingTime": "Dienstag 10:00 oder Mittwoch 14:00",
      "engagementTip": "Tipp für mehr Engagement"
    },
    {
      "platform": "linkedin",
      "accountType": "employee",
      "content": "Persönlicherer Post für Mitarbeiter...",
      ...
    }
  ]
}`;

interface SocialPost {
  platform: string;
  accountType: "company" | "employee";
  content: string;
  hashtags: string[];
  suggestedImagePrompt?: string;
  bestPostingTime?: string;
  engagementTip?: string;
}

export const socialPostCreator = inngest.createFunction(
  {
    id: "social-post-creator",
    name: "Social Post Creator",
    concurrency: {
      limit: 5,
      key: "event.data.customerId",
    },
    retries: 3,
  },
  { event: "content/generate-social-posts" },
  async ({ event, step }) => {
    const { articleId, projectId, userId, customerId, workspaceId, platforms } = event.data as {
      articleId: string;
      projectId: string;
      userId: string;
      customerId: string;
      workspaceId: string;
      platforms: ("linkedin" | "twitter" | "instagram" | "facebook")[];
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
        eventType: "content/generate-social-posts",
        inputData: { articleId, platforms },
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

      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        status: "running",
        currentStep: "Fetching article",
        progress: 10,
      });

      return articleData;
    });

    // Step 4: Generate posts for each platform
    const generatedPosts = await step.run("generate-posts", async () => {
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        currentStep: "Generating social posts",
        progress: 30,
      });

      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 6000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Erstelle Social Media Posts für folgende Plattformen: ${platforms.join(", ")}

**Artikel:**
Titel: ${article.title}
Keyword: ${article.primaryKeyword || "nicht definiert"}
Meta Description: ${article.metaDescription || "nicht vorhanden"}

Content (Auszug):
${(article.contentMarkdown || "").substring(0, 3000)}

---

Erstelle je 2 Post-Varianten pro Plattform:
1. Company Voice (offizieller Unternehmenskanal)
2. Employee/Personal Voice (für Mitarbeiter-Sharing)

Gib die Posts im JSON-Format zurück.`,
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
        throw new Error("Could not parse JSON response");
      }

      const result = JSON.parse(jsonMatch[0]) as { posts: SocialPost[] };
      return result.posts;
    });

    // Step 5: Save posts as content assets
    const savedPosts = await step.run("save-posts", async () => {
      await convex.action(api.agents.actions.updateAgentJob, {
        inngestEventId: event.id || `${Date.now()}`,
        currentStep: "Saving posts",
        progress: 80,
      });

      const assets = generatedPosts.map((post) => ({
        projectId,
        articleId,
        jobId: event.id,
        assetType: "social_post",
        platform: post.platform,
        accountType: post.accountType,
        title: `${post.platform} - ${post.accountType}`,
        content: post.content,
        contentJson: post,
        metadata: {
          hashtags: post.hashtags,
          suggestedImagePrompt: post.suggestedImagePrompt,
          bestPostingTime: post.bestPostingTime,
          engagementTip: post.engagementTip,
        },
        status: "draft",
      }));

      const result = await convex.action(api.agents.actions.createContentAssetsBatch, {
        assets,
      });

      return result.assetIds;
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
          postsCreated: generatedPosts.length,
          platforms,
          assetIds: savedPosts,
        },
      });
    });

    return {
      success: true,
      articleId,
      postsCreated: generatedPosts.length,
      platforms,
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
