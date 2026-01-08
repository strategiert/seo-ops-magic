// supabase/functions/_shared/sectionWriter.ts
// Section Writer - Schreibt einzelne Artikel-Abschnitte
// Plan Phase 3.3: Section Writer (LLM)

import { routeToModel, getGeminiEndpoint } from "./model-router.ts";
import type { Section, Outline } from "./outlineGenerator.ts";
import type { ResearchPack } from "./researchPack.ts";

// ============================================================================
// INTERFACES
// ============================================================================

export interface SectionDraft {
  sectionIndex: number;
  headingType: 'h1' | 'h2' | 'h3';
  heading: string;
  content: string;           // Markdown content (ohne Heading)
  wordCount: number;
  keywordsUsed: string[];    // Welche Keywords wurden tatsächlich verwendet
}

export interface SectionContext {
  previousSections: SectionDraft[];  // Bisherige Sections für Kontext
  outline: Outline;
  researchPack: ResearchPack;
  brandVoice?: string;
}

export interface WriteSectionOptions {
  keywordSuggestions?: string[];     // Vorschläge vom KeywordTracker
  additionalInstructions?: string;
  maxRetries?: number;
}

// ============================================================================
// SECTION WRITER
// ============================================================================

/**
 * Schreibt eine einzelne Section basierend auf der Outline
 */
export async function writeSection(
  section: Section,
  context: SectionContext,
  options: WriteSectionOptions = {}
): Promise<SectionDraft> {
  const { keywordSuggestions = [], additionalInstructions } = options;
  const { previousSections, outline, researchPack, brandVoice } = context;

  // Kontext aus vorherigen Sections (letzte 2-3)
  const recentContext = previousSections.slice(-3).map(s =>
    `### ${s.heading}\n${s.content.substring(0, 300)}...`
  ).join("\n\n");

  // Keywords für diese Section
  const sectionKeywords = [
    ...section.plannedKeywords,
    ...keywordSuggestions.slice(0, 5),
  ];

  const systemPrompt = `Du bist ein erfahrener SEO-Texter. Du schreibst EINEN Abschnitt eines Artikels.
- Schreibe NUR den Inhalt für diesen einen Abschnitt
- KEIN JSON, nur Markdown
- Beginne NICHT mit der Überschrift (die wird separat hinzugefügt)
- Schreibe substanzielle, informative Absätze
- Keine leeren Phrasen oder Fülltext`;

  const userPrompt = `Schreibe Abschnitt ${section.index + 1} von ${outline.sections.length} für den Artikel "${outline.title}".

## Dieser Abschnitt
- Überschrift: "${section.headingText}"
- Typ: ${section.headingType.toUpperCase()}
- Ziel: ${section.purpose}
- Ziel-Wortanzahl: ~${section.targetWordCount} Wörter

## Keywords die in diesem Abschnitt vorkommen MÜSSEN
${sectionKeywords.map(k => `- "${k}"`).join("\n")}

## Artikel-Kontext
- Hauptthema: ${researchPack.keyword}
- Suchintention: ${researchPack.intent.primary}
- Gesamter Artikel: ${outline.totalWordCount} Wörter
${previousSections.length > 0 ? `\n## Bisheriger Inhalt (für Kontext)\n${recentContext}` : ""}

## Stil-Vorgaben
${brandVoice || "- Professionell aber zugänglich\n- Konkret und informativ\n- Aktive Sprache"}
- Nutze Beispiele, Listen oder Tabellen wo sinnvoll
- Vermeide "Skinny Paragraphs" (zu kurze Absätze)
- Natürlicher Keyword-Einbau (kein Keyword-Stuffing)

${section.imageNeeded ? `## Bild\nFüge am Ende einen Bild-Prompt ein:\n[IMAGE_PROMPT: Beschreibung für ${section.imageContext || section.headingText}]` : ""}

${additionalInstructions ? `## Zusätzliche Anweisungen\n${additionalInstructions}` : ""}

Schreibe NUR den Inhalt für diesen Abschnitt (OHNE Überschrift, KEIN JSON):`;

  // Model Routing
  const modelConfig = routeToModel("section_writing", userPrompt, {
    targetLength: section.targetWordCount,
  });

  console.log(`[SectionWriter] Writing section ${section.index}: "${section.headingText}"`);

  // LLM Call
  const response = await fetch(getGeminiEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("GEMINI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[SectionWriter] API Error:", err);
    throw new Error(`Section writing failed: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from LLM");
  }

  // Cleanup: Falls LLM trotzdem mit Überschrift beginnt
  content = cleanupSectionContent(content, section.headingText);

  // Keywords extrahieren die tatsächlich verwendet wurden
  const keywordsUsed = extractUsedKeywords(content, sectionKeywords);

  // Wortanzahl zählen
  const wordCount = countWords(content);

  console.log(`[SectionWriter] Section ${section.index} written: ${wordCount} words, ${keywordsUsed.length}/${sectionKeywords.length} keywords used`);

  return {
    sectionIndex: section.index,
    headingType: section.headingType,
    heading: section.headingText,
    content,
    wordCount,
    keywordsUsed,
  };
}

/**
 * Schreibt die H1/Intro Section
 */
export async function writeIntroSection(
  outline: Outline,
  researchPack: ResearchPack,
  options: { brandVoice?: string; keyTakeaways?: string[] } = {}
): Promise<string> {
  const { brandVoice, keyTakeaways } = options;

  const systemPrompt = `Du bist ein SEO-Texter. Schreibe eine packende Einleitung für einen Artikel.
- Markdown Format
- Starte mit einer "Key Takeaways" Box
- Dann 1-2 einleitende Absätze
- KEIN JSON`;

  const takeaways = keyTakeaways || [
    `Wichtigste Fakten zu ${researchPack.keyword}`,
    "Praktische Tipps und Empfehlungen",
    "Aktuelle Informationen und Trends",
  ];

  const userPrompt = `Schreibe die Einleitung für: "${outline.h1}"

## Artikel-Übersicht
- Thema: ${researchPack.keyword}
- Suchintention: ${researchPack.intent.primary}
- Zielgruppe: ${researchPack.intent.stage}

## Key Takeaways (als Blockquote formatieren)
${takeaways.map(t => `- ${t}`).join("\n")}

## Hauptkeyword
"${researchPack.keyword}" muss natürlich eingebaut werden.

${brandVoice ? `## Stil\n${brandVoice}` : ""}

Schreibe:
1. H1 mit Keyword
2. Key Takeaways Box (als > Blockquote)
3. 1-2 einleitende Absätze (~150 Wörter)`;

  const modelConfig = routeToModel("section_writing", userPrompt, { targetLength: 200 });

  const response = await fetch(getGeminiEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("GEMINI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new Error(`Intro writing failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Schreibt die FAQ Section
 */
export async function writeFaqSection(
  questions: string[],
  researchPack: ResearchPack
): Promise<string> {
  const systemPrompt = `Du bist ein SEO-Texter. Schreibe FAQ-Antworten.
- Kurze, prägnante Antworten (2-4 Sätze pro Frage)
- FAQ Schema-freundliches Format
- Markdown`;

  const userPrompt = `Schreibe FAQ-Antworten für "${researchPack.keyword}":

${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Format:
## Häufig gestellte Fragen

### Frage?
Antwort...`;

  const modelConfig = routeToModel("section_writing", userPrompt, { targetLength: 400 });

  const response = await fetch(getGeminiEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("GEMINI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`FAQ writing failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Bereinigt Section-Content
 */
function cleanupSectionContent(content: string, expectedHeading: string): string {
  let cleaned = content.trim();

  // Entferne Heading falls LLM es trotzdem eingefügt hat
  const headingPatterns = [
    new RegExp(`^#+\\s*${escapeRegex(expectedHeading)}\\s*\n`, 'i'),
    /^#+\s+.+\n/,  // Irgendein Markdown Heading am Anfang
  ];

  for (const pattern of headingPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Entferne führende/trailing Whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Extrahiert verwendete Keywords aus dem Text
 */
function extractUsedKeywords(text: string, keywords: string[]): string[] {
  const textLower = text.toLowerCase();
  return keywords.filter(kw => textLower.includes(kw.toLowerCase()));
}

/**
 * Zählt Wörter im Text
 */
function countWords(text: string): number {
  return text
    .replace(/[#*_\[\]()>`-]/g, ' ')  // Markdown entfernen
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
}

/**
 * Escaped Regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// SECTION ASSEMBLER
// ============================================================================

/**
 * Fügt alle Sections zu einem vollständigen Artikel zusammen
 */
export function assembleSections(
  intro: string,
  sections: SectionDraft[],
  faq?: string
): string {
  const parts: string[] = [];

  // Intro (enthält bereits H1)
  parts.push(intro);
  parts.push('');

  // Body Sections
  for (const section of sections) {
    const prefix = section.headingType === 'h2' ? '## ' :
                   section.headingType === 'h3' ? '### ' : '# ';
    parts.push(`${prefix}${section.heading}`);
    parts.push('');
    parts.push(section.content);
    parts.push('');
  }

  // FAQ
  if (faq) {
    parts.push(faq);
  }

  return parts.join('\n');
}
