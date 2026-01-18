"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * Article Generation Action
 *
 * Generates full SEO-optimized articles from content briefs.
 * Converted from supabase/functions/generate-article/index.ts
 *
 * Flow:
 * 1. Load brief and brand context
 * 2. Build research pack
 * 3. Generate outline
 * 4. Write intro section
 * 5. Write each section with quality control
 * 6. Generate FAQ
 * 7. Assemble and save article
 */

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

interface Outline {
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  sections: Array<{
    heading: string;
    level: number;
    purpose: string;
    targetWords: number;
    keywords: string[];
  }>;
  faqQuestions: string[];
}

interface GenerationProgress {
  phase: "research" | "outline" | "writing" | "review" | "finalizing";
  currentSection?: number;
  totalSections?: number;
  sectionName?: string;
}

/**
 * Call Gemini API
 */
async function callGemini(
  prompt: string,
  systemPrompt?: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options?.model || "gemini-2.0-flash",
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
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
 * Generate an article from a content brief
 */
export const generate = action({
  args: {
    briefId: v.id("contentBriefs"),
    options: v.optional(
      v.object({
        minLocalScore: v.optional(v.number()),
        maxRetries: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, { briefId, options }): Promise<{
    success: boolean;
    articleId?: string;
    title?: string;
    wordCount?: number;
    sectionsWritten?: number;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Unauthorized" };
    }

    const minLocalScore = options?.minLocalScore ?? 70;
    const maxRetries = options?.maxRetries ?? 2;

    // Get brief with context
    const briefData = await ctx.runQuery(api.tables.contentBriefs.getWithContext, {
      id: briefId,
    });

    if (!briefData) {
      return { success: false, error: "Brief not found" };
    }

    const brief = briefData;
    const project = briefData.project;
    const brandProfile = briefData.brandProfile;

    // Update brief status
    await ctx.runMutation(api.tables.contentBriefs.update, {
      id: briefId,
      status: "in_progress",
    });

    try {
      // Build brand context
      const brandContext = buildBrandContext(brandProfile);

      // Generate outline
      console.log("Generating outline...");
      const outline = await generateOutline({
        title: brief.title,
        keyword: brief.primaryKeyword,
        searchIntent: brief.searchIntent,
        targetAudience: brief.targetAudience || project?.defaultTargetAudience,
        tonality: brief.tonality || project?.defaultTonality,
        targetLength: brief.targetLength,
        brandContext,
      });

      // Write introduction
      console.log("Writing introduction...");
      const intro = await writeIntro({
        outline,
        keyword: brief.primaryKeyword,
        brandContext,
        tonality: brief.tonality,
      });

      // Write each section
      console.log(`Writing ${outline.sections.length} sections...`);
      const sections: string[] = [];
      let previousContent = intro;

      for (let i = 0; i < outline.sections.length; i++) {
        const section = outline.sections[i];
        console.log(`Writing section ${i + 1}: ${section.heading}`);

        let sectionContent = await writeSection({
          section,
          outline,
          previousContent: previousContent.slice(-3000), // Last 3000 chars for context
          keyword: brief.primaryKeyword,
          brandContext,
          tonality: brief.tonality,
        });

        // Quality check and retry if needed
        let attempts = 0;
        while (attempts < maxRetries) {
          const score = calculateLocalScore(sectionContent, section.keywords);
          if (score >= minLocalScore) break;

          console.log(`Section ${i + 1} score ${score} < ${minLocalScore}, retrying...`);
          sectionContent = await fixSection({
            content: sectionContent,
            section,
            keywords: section.keywords,
            score,
          });
          attempts++;
        }

        sections.push(sectionContent);
        previousContent += "\n\n" + sectionContent;
      }

      // Write FAQ section
      console.log("Writing FAQ...");
      const faq = await writeFaq({
        questions: outline.faqQuestions,
        keyword: brief.primaryKeyword,
        brandContext,
      });

      // Assemble full article
      const fullMarkdown = [intro, ...sections, faq].join("\n\n");
      const wordCount = fullMarkdown.split(/\s+/).length;

      // Build FAQ JSON
      const faqJson = parseFaqJson(faq, outline.faqQuestions);

      // Create article
      const articleId = await ctx.runMutation(api.tables.articles.create, {
        projectId: brief.projectId,
        briefId: brief._id,
        title: outline.title,
        primaryKeyword: brief.primaryKeyword,
        contentMarkdown: fullMarkdown,
        metaTitle: outline.metaTitle,
        metaDescription: outline.metaDescription,
        outlineJson: outline,
        faqJson,
        status: "draft",
      });

      // Update brief status
      await ctx.runMutation(api.tables.contentBriefs.update, {
        id: briefId,
        status: "completed",
      });

      return {
        success: true,
        articleId,
        title: outline.title,
        wordCount,
        sectionsWritten: sections.length + 2, // +2 for intro and FAQ
      };
    } catch (error) {
      console.error("Article generation error:", error);

      // Revert brief status
      await ctx.runMutation(api.tables.contentBriefs.update, {
        id: briefId,
        status: "draft",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Generation failed",
      };
    }
  },
});

/**
 * Build brand context string from brand profile
 */
function buildBrandContext(brandProfile: any): string {
  if (!brandProfile) return "";

  const parts: string[] = [];

  if (brandProfile.brandName) {
    parts.push(`Marke: ${brandProfile.brandName}`);
  }
  if (brandProfile.tagline) {
    parts.push(`Slogan: ${brandProfile.tagline}`);
  }

  // Brand voice
  if (brandProfile.brandVoice) {
    const voice = brandProfile.brandVoice;
    if (voice.tone?.length) {
      parts.push(`Tonalität: ${voice.tone.join(", ")}`);
    }
    if (voice.personality_traits?.length) {
      parts.push(`Persönlichkeit: ${voice.personality_traits.join(", ")}`);
    }
  }

  // Top products/services
  if (brandProfile.products?.length) {
    const topProducts = brandProfile.products.slice(0, 3);
    parts.push(
      `Produkte: ${topProducts.map((p: any) => p.name).join(", ")}`
    );
  }
  if (brandProfile.services?.length) {
    const topServices = brandProfile.services.slice(0, 3);
    parts.push(
      `Leistungen: ${topServices.map((s: any) => s.name).join(", ")}`
    );
  }

  // Keywords
  if (brandProfile.brandKeywords?.primary?.length) {
    parts.push(`Marken-Keywords: ${brandProfile.brandKeywords.primary.join(", ")}`);
  }

  return parts.length > 0 ? `\n\n## Markenkontext\n${parts.join("\n")}` : "";
}

/**
 * Generate article outline
 */
async function generateOutline(params: {
  title: string;
  keyword: string;
  searchIntent?: string;
  targetAudience?: string;
  tonality?: string;
  targetLength?: number;
  brandContext: string;
}): Promise<Outline> {
  const { title, keyword, searchIntent, targetAudience, tonality, targetLength, brandContext } = params;

  const systemPrompt = `Du bist ein SEO-Experte, der strukturierte Artikel-Gliederungen erstellt.
Antworte NUR mit validem JSON ohne Markdown-Codeblöcke.`;

  const userPrompt = `Erstelle eine SEO-optimierte Gliederung für:

Titel: ${title}
Hauptkeyword: ${keyword}
Suchintention: ${searchIntent || "informational"}
Zielgruppe: ${targetAudience || "allgemein"}
Tonalität: ${tonality || "professionell"}
Ziellänge: ${targetLength || 1500} Wörter
${brandContext}

JSON-Format:
{
  "title": "SEO-optimierter Titel mit Keyword",
  "metaTitle": "Meta-Titel (max 60 Zeichen)",
  "metaDescription": "Meta-Beschreibung (max 155 Zeichen)",
  "h1": "H1 Überschrift mit Keyword",
  "sections": [
    {
      "heading": "H2/H3 Überschrift",
      "level": 2,
      "purpose": "Was behandelt dieser Abschnitt",
      "targetWords": 200,
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "faqQuestions": ["Frage 1?", "Frage 2?", "Frage 3?"]
}

Erstelle 4-6 Hauptabschnitte (H2) mit optionalen Unterabschnitten (H3).`;

  const response = await callGemini(userPrompt, systemPrompt, { temperature: 0.5 });

  try {
    const jsonStr = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonStr);
  } catch {
    // Fallback outline
    return {
      title: title,
      metaTitle: `${title} - Ratgeber`,
      metaDescription: `Erfahren Sie alles über ${keyword}. Umfassender Ratgeber mit praktischen Tipps.`,
      h1: title,
      sections: [
        {
          heading: `Was ist ${keyword}?`,
          level: 2,
          purpose: "Einführung und Definition",
          targetWords: 200,
          keywords: [keyword],
        },
        {
          heading: `Vorteile von ${keyword}`,
          level: 2,
          purpose: "Nutzen und Vorteile erklären",
          targetWords: 250,
          keywords: [keyword, "vorteile"],
        },
        {
          heading: `${keyword} im Alltag`,
          level: 2,
          purpose: "Praktische Anwendung",
          targetWords: 250,
          keywords: [keyword, "anwendung"],
        },
        {
          heading: "Fazit",
          level: 2,
          purpose: "Zusammenfassung",
          targetWords: 150,
          keywords: [keyword],
        },
      ],
      faqQuestions: [
        `Was kostet ${keyword}?`,
        `Wie funktioniert ${keyword}?`,
        `Wo kann ich ${keyword} kaufen?`,
      ],
    };
  }
}

/**
 * Write introduction section
 */
async function writeIntro(params: {
  outline: Outline;
  keyword: string;
  brandContext: string;
  tonality?: string;
}): Promise<string> {
  const { outline, keyword, brandContext, tonality } = params;

  const systemPrompt = `Du bist ein professioneller Content-Writer.
Schreibe packende Einleitungen mit "Key Takeaways" Box.
Formatiere mit Markdown.`;

  const userPrompt = `Schreibe die Einleitung für diesen Artikel:

# ${outline.h1}

Hauptkeyword: ${keyword}
Tonalität: ${tonality || "professionell"}
${brandContext}

Die Einleitung soll:
1. Mit einem starken Hook beginnen
2. Das Keyword natürlich einbauen
3. Eine "Key Takeaways" Box mit 3-4 Punkten enthalten
4. Etwa 150 Wörter lang sein
5. Den Leser neugierig machen

Formatiere die Key Takeaways so:
> **Key Takeaways:**
> - Punkt 1
> - Punkt 2
> - Punkt 3`;

  return await callGemini(userPrompt, systemPrompt, { temperature: 0.7 });
}

/**
 * Write a single section
 */
async function writeSection(params: {
  section: Outline["sections"][0];
  outline: Outline;
  previousContent: string;
  keyword: string;
  brandContext: string;
  tonality?: string;
}): Promise<string> {
  const { section, outline, previousContent, keyword, brandContext, tonality } = params;

  const systemPrompt = `Du bist ein SEO-Content-Writer.
Schreibe informative, gut strukturierte Abschnitte.
Verwende Markdown für Formatierung.
Baue die angegebenen Keywords natürlich ein.`;

  const userPrompt = `Schreibe folgenden Abschnitt:

## ${section.heading}

Zweck: ${section.purpose}
Ziel-Wortanzahl: ${section.targetWords} Wörter
Einzubauende Keywords: ${section.keywords.join(", ")}
Hauptkeyword des Artikels: ${keyword}
Tonalität: ${tonality || "professionell"}

Vorheriger Inhalt (für Kontext):
${previousContent.slice(-1500)}

${brandContext}

Schreibe den Abschnitt jetzt. Beginne direkt mit der Überschrift.`;

  return await callGemini(userPrompt, systemPrompt, { temperature: 0.7 });
}

/**
 * Fix a section that didn't pass quality check
 */
async function fixSection(params: {
  content: string;
  section: Outline["sections"][0];
  keywords: string[];
  score: number;
}): Promise<string> {
  const { content, section, keywords, score } = params;

  const systemPrompt = `Du bist ein SEO-Editor.
Verbessere den Text, um die Keywords besser einzubauen.
Behalte die Länge und Struktur bei.`;

  const userPrompt = `Dieser Abschnitt hat nur ${score}% Keyword-Score erreicht.
Verbessere ihn, um diese Keywords natürlicher einzubauen: ${keywords.join(", ")}

Originaler Text:
${content}

Anforderungen:
- Behalte die Länge bei (mindestens 80% des Originals)
- Baue die Keywords natürlicher ein
- Behalte den informativen Stil

Schreibe den verbesserten Abschnitt:`;

  const fixed = await callGemini(userPrompt, systemPrompt, { temperature: 0.5 });

  // Validate fix isn't too short
  if (fixed.length < content.length * 0.5) {
    return content; // Keep original if fix is too short
  }

  return fixed;
}

/**
 * Write FAQ section
 */
async function writeFaq(params: {
  questions: string[];
  keyword: string;
  brandContext: string;
}): Promise<string> {
  const { questions, keyword, brandContext } = params;

  const systemPrompt = `Du bist ein FAQ-Autor.
Schreibe kurze, präzise Antworten (2-4 Sätze pro Frage).
Formatiere mit Markdown.`;

  const userPrompt = `Schreibe FAQ-Antworten für diese Fragen:

${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Hauptkeyword: ${keyword}
${brandContext}

Format:
## Häufig gestellte Fragen

### Frage 1?
Antwort in 2-4 Sätzen.

### Frage 2?
Antwort in 2-4 Sätzen.

usw.`;

  return await callGemini(userPrompt, systemPrompt, { temperature: 0.5 });
}

/**
 * Calculate local keyword score
 */
function calculateLocalScore(content: string, keywords: string[]): number {
  if (!keywords.length) return 100;

  const lowerContent = content.toLowerCase();
  let found = 0;

  for (const keyword of keywords) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      found++;
    }
  }

  return Math.round((found / keywords.length) * 100);
}

/**
 * Parse FAQ content into structured JSON
 */
function parseFaqJson(
  faqContent: string,
  questions: string[]
): Array<{ question: string; answer: string }> {
  const result: Array<{ question: string; answer: string }> = [];

  // Try to parse from the content
  const qaPattern = /###\s*(.+?)\?\s*([\s\S]*?)(?=###|$)/g;
  let match;

  while ((match = qaPattern.exec(faqContent)) !== null) {
    result.push({
      question: match[1].trim() + "?",
      answer: match[2].trim(),
    });
  }

  // Fallback to original questions if parsing failed
  if (result.length === 0) {
    for (const q of questions) {
      result.push({
        question: q,
        answer: "Antwort wird generiert...",
      });
    }
  }

  return result;
}
