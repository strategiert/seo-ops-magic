import { inngest, AGENT_COSTS } from "../../client";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Ad Copy Writer Agent
 *
 * Creates advertising copy for Google, Meta, and LinkedIn Ads.
 * Follows platform-specific requirements and character limits.
 *
 * Input: Article ID and target ad platforms
 * Output: Multiple ad variants per platform
 *
 * Cost: 4 credits (multiple variants)
 */

const SYSTEM_PROMPT = `Du bist ein Performance Marketing Experte. Erstelle Werbetexte für verschiedene Plattformen.

## Google Ads (Responsive Search Ads)
- Headlines: 15 Stück, max 30 Zeichen
- Descriptions: 4 Stück, max 90 Zeichen
- Keyword im ersten Headline
- CTA in Description

## Meta Ads (Facebook/Instagram)
- Primary Text: 125 Zeichen (mehr wird abgeschnitten)
- Headline: 40 Zeichen
- Description: 30 Zeichen
- Emotional Hooks verwenden
- Social Proof wenn möglich

## LinkedIn Ads
- Intro Text: 150 Zeichen
- Headline: 70 Zeichen
- Description: 100 Zeichen
- B2B Fokus, professioneller Ton

## Copywriting-Formeln:
- AIDA: Attention, Interest, Desire, Action
- PAS: Problem, Agitation, Solution
- BAB: Before, After, Bridge

## Output Format (JSON):
{
  "ads": [
    {
      "platform": "google",
      "headlines": ["Headline 1", "Headline 2", ...],
      "descriptions": ["Description 1", ...],
      "targetKeywords": ["keyword1", "keyword2"]
    },
    {
      "platform": "meta",
      "variants": [
        {
          "primaryText": "...",
          "headline": "...",
          "description": "...",
          "ctaButton": "Learn More"
        }
      ]
    }
  ]
}`;

export const adCopyWriter = inngest.createFunction(
  {
    id: "ad-copy-writer",
    name: "Ad Copy Writer",
    concurrency: {
      limit: 5,
      key: "event.data.customerId",
    },
    retries: 3,
  },
  { event: "content/generate-ad-copies" },
  async ({ event, step }) => {
    const { articleId, projectId, userId, customerId, platforms } = event.data;

    // Step 1: Fetch article
    const article = await step.run("fetch-article", async () => {
      // TODO: Fetch from Convex
      return {
        title: "Content Marketing Guide 2024",
        contentMarkdown: "# Content Marketing\n\nPlaceholder...",
        primaryKeyword: "content marketing",
        metaDescription: "Der ultimative Content Marketing Guide für 2024.",
      };
    });

    // Step 2: Generate ad copies
    const ads = await step.run("generate-ads", async () => {
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Erstelle Werbetexte für: ${platforms.join(", ")}

**Artikel:**
Titel: ${article.title}
Keyword: ${article.primaryKeyword}
Meta: ${article.metaDescription}
Content-Auszug:
${article.contentMarkdown.substring(0, 1500)}

Erstelle mehrere Varianten pro Plattform für A/B Testing.`,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response");
      }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse JSON");
      }

      return JSON.parse(jsonMatch[0]);
    });

    // Step 3: Save ad copies
    await step.run("save-ads", async () => {
      // TODO: Save to Convex contentAssets table
      console.log("Would save ad copies for platforms:", platforms);
    });

    // Step 4: Deduct credits
    await step.run("deduct-credits", async () => {
      console.log("Would deduct", AGENT_COSTS["ad-copy-writer"], "credits");
    });

    return {
      success: true,
      articleId,
      platforms,
      creditsUsed: AGENT_COSTS["ad-copy-writer"],
    };
  }
);
