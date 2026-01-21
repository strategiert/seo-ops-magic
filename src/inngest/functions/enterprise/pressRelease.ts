import { inngest, AGENT_COSTS } from "../../client";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Press Release Writer Agent
 *
 * Creates professional press releases following AP Style guidelines.
 * Includes proper structure, quotes, and boilerplate.
 *
 * Input: Article ID
 * Output: Press release document
 *
 * Cost: 6 credits (structured content)
 */

const SYSTEM_PROMPT = `Du bist ein erfahrener PR-Texter. Erstelle professionelle Pressemeldungen nach AP Style.

## Pressemeldungs-Struktur:
1. **Headline**: Prägnant, newsworthy, max 80 Zeichen
2. **Subheadline**: Zusätzlicher Kontext
3. **Dateline**: ORT, Datum —
4. **Lead Paragraph**: Wer, Was, Wann, Wo, Warum (5 Ws)
5. **Body**: Weitere Details, Zitate, Kontext
6. **Boilerplate**: Über das Unternehmen
7. **Kontakt**: Presseabteilung

## AP Style Regeln:
- Aktive Sprache verwenden
- Zitate von Führungskräften einbauen
- Zahlen unter 10 ausschreiben
- Keine Übertreibungen oder Werbejargon
- Faktenbasiert und objektiv

## Quote-Formate:
- "Statement," sagte [Name], [Titel] bei [Unternehmen].
- [Name] ergänzte: "Weiteres Statement."

## Output Format (JSON):
{
  "pressRelease": {
    "headline": "...",
    "subheadline": "...",
    "dateline": "BERLIN, 20. Januar 2026 —",
    "leadParagraph": "...",
    "bodyParagraphs": ["...", "..."],
    "quotes": [
      {
        "text": "Quote text",
        "speaker": "Max Mustermann",
        "title": "CEO",
        "company": "Musterfirma GmbH"
      }
    ],
    "boilerplate": "Über [Unternehmen]: ...",
    "contact": {
      "name": "Pressekontakt",
      "email": "presse@example.com",
      "phone": "+49 123 456789"
    }
  },
  "distributionSuggestions": {
    "targetMedia": ["Branchenmagazine", "Wirtschaftspresse"],
    "timing": "Dienstagmorgen für maximale Reichweite",
    "angle": "Innovation / Thought Leadership"
  }
}`;

export const pressReleaseWriter = inngest.createFunction(
  {
    id: "press-release-writer",
    name: "Press Release Writer",
    concurrency: {
      limit: 3,
      key: "event.data.customerId",
    },
    retries: 3,
  },
  { event: "content/generate-press-release" },
  async ({ event, step }) => {
    const { articleId, projectId, userId, customerId } = event.data;

    // Step 1: Fetch article and company info
    const data = await step.run("fetch-data", async () => {
      // TODO: Fetch from Convex
      return {
        article: {
          title: "Neuer Guide zu Content Marketing veröffentlicht",
          contentMarkdown: "# Content Marketing Guide...",
          primaryKeyword: "content marketing",
        },
        company: {
          name: "Musterfirma GmbH",
          description: "Musterfirma ist ein führender Anbieter von...",
          ceo: "Max Mustermann",
          pressContact: {
            name: "Lisa Müller",
            email: "presse@musterfirma.de",
            phone: "+49 123 456789",
          },
        },
      };
    });

    // Step 2: Generate press release
    const pressRelease = await step.run("generate-press-release", async () => {
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Erstelle eine Pressemeldung basierend auf diesem Artikel:

**Artikel:**
Titel: ${data.article.title}
Keyword: ${data.article.primaryKeyword}
Content:
${data.article.contentMarkdown.substring(0, 2000)}

**Unternehmen:**
Name: ${data.company.name}
Beschreibung: ${data.company.description}
CEO: ${data.company.ceo}

Erstelle eine professionelle Pressemeldung im JSON-Format.`,
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

    // Step 3: Save press release
    await step.run("save-press-release", async () => {
      // TODO: Save to Convex contentAssets table
      console.log("Would save press release");
    });

    // Step 4: Deduct credits
    await step.run("deduct-credits", async () => {
      console.log("Would deduct", AGENT_COSTS["press-release"], "credits");
    });

    return {
      success: true,
      articleId,
      headline: pressRelease.pressRelease?.headline,
      creditsUsed: AGENT_COSTS["press-release"],
    };
  }
);
