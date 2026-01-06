/**
 * LLM Client for Recipe Generation
 * Supports Gemini, OpenAI, and Anthropic
 */

import type { ArticleMeta } from "./types.ts";
import { getGeminiEndpoint } from "./model-router.ts";

// ============================================================================
// JSON EXTRACTION
// ============================================================================

/**
 * Robust JSON extractor for LLM responses
 * Handles markdown fences and finds JSON object
 */
export function extractJsonObject(text: string): unknown {
  const t = text.trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in LLM response");
  }

  return JSON.parse(t.slice(start, end + 1));
}

// ============================================================================
// PROMPT CONSTRUCTION
// ============================================================================

const SYSTEM_PROMPT = `Du bist ein Layout Planner für SEO-Artikel. Du gibst NUR JSON gemäß Schema zurück.

WICHTIG:
- Keine Erklärungen, keine Kommentare
- Nur valides JSON
- Beginne direkt mit {
- Ende mit }

SCHEMA (RecipeSchema):
{
  "recipeVersion": "v1",
  "theme": "editorial-bold" | "minimal-clean" | "tech-neon",
  "toc": true | false,
  "layout": [
    // Für Listen:
    { "blockId": "list-0", "component": "list", "variant": "checklist" | "steps" | "cards" | "plain" },
    // Für Tabellen:
    { "blockId": "table-0", "component": "table", "variant": "comparisonSticky" | "zebra" | "plain" },
    // Für Kontrast-Paare (zwei aufeinanderfolgende Absätze mit Gegensätzen):
    { "component": "contrastPair", "leftBlockId": "paragraph-1", "rightBlockId": "paragraph-2", "variant": "splitCards", "labelLeft": "Pro", "labelRight": "Contra" }
  ]
}

VARIANTEN-REGELN:
- list "checklist": Für To-Do Listen, Anforderungen, Features
- list "steps": Für Anleitungen, Prozesse, Reihenfolgen
- list "cards": Für Vorteile, Eigenschaften die hervorgehoben werden sollen
- table "comparisonSticky": Für Produktvergleiche
- table "zebra": Für Datentabellen
- contrastPair: NUR wenn zwei Absätze sich KLAR widersprechen oder Pro/Contra sind`;

function buildUserPrompt(articleMeta: ArticleMeta, blocksSummary: object[]): string {
  return `ARTIKEL:
Titel: ${articleMeta.title}
Meta: ${articleMeta.metaDescription || ""}
Keyword: ${articleMeta.primaryKeyword || ""}

BLOCKS:
${JSON.stringify(blocksSummary, null, 2)}

AUFGABEN:
1) Wähle ein theme das zum Artikel passt
2) Für jedes list-Block: setze sinnvolle variant (checklist/steps/cards/plain)
3) Für jedes table-Block: setze variant (comparisonSticky für Vergleiche, zebra sonst)
4) OPTIONAL: Wenn zwei aufeinanderfolgende paragraph-Blocks klar kontrastieren, erstelle EIN contrastPair (max 2 pro Artikel)
5) Normale paragraphs und headings brauchen KEIN layout item (werden automatisch gerendert)

Antworte NUR mit dem JSON.`;
}

// ============================================================================
// GEMINI CLIENT
// ============================================================================

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(getGeminiEndpoint("/chat/completions"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash", // Fast and reliable for JSON
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.3, // Low temperature for consistent JSON output
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export type LlmProvider = "gemini" | "openai" | "anthropic";

export interface GenerateRecipeOptions {
  provider?: LlmProvider;
  apiKey?: string;
}

/**
 * Generate a design recipe using LLM
 * Returns parsed JSON object (not validated yet)
 */
export async function generateRecipeWithLlm(
  articleMeta: ArticleMeta,
  blocksSummary: object[],
  options: GenerateRecipeOptions = {}
): Promise<{ json: unknown; provider: string }> {
  const provider = options.provider || (Deno.env.get("LLM_PROVIDER") as LlmProvider) || "gemini";

  const userPrompt = buildUserPrompt(articleMeta, blocksSummary);

  let content: string;

  switch (provider) {
    case "gemini": {
      const apiKey = options.apiKey || Deno.env.get("GEMINI_API_KEY");
      if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
      content = await callGemini(SYSTEM_PROMPT, userPrompt, apiKey);
      break;
    }
    case "openai": {
      // Placeholder for OpenAI implementation
      throw new Error("OpenAI provider not yet implemented");
    }
    case "anthropic": {
      // Placeholder for Anthropic implementation
      throw new Error("Anthropic provider not yet implemented");
    }
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }

  // Extract and parse JSON
  const json = extractJsonObject(content);

  return { json, provider };
}
