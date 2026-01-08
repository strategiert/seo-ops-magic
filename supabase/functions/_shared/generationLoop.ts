// supabase/functions/_shared/generationLoop.ts
// Generation Loop - Orchestriert die komplette Artikel-Generierung
// Plan Phase 4: Generation Loop

import { buildResearchPack, type ResearchPack, type BuildResearchPackOptions } from "./researchPack.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateOutline, createBasicOutline, type Outline } from "./outlineGenerator.ts";
import {
  writeSection,
  writeIntroSection,
  writeFaqSection,
  assembleSections,
  type SectionDraft,
  type SectionContext,
} from "./sectionWriter.ts";
import {
  QualityController,
  generateFixPrompt,
  type QAResult,
} from "./qualityController.ts";
import { routeToModel, getGeminiEndpoint } from "./model-router.ts";

// ============================================================================
// INTERFACES
// ============================================================================

export interface GenerationConfig {
  projectId: string;
  keyword: string;
  nwQueryId?: string;           // NeuronWriter Query ID (optional)
  nwGuidelines?: any;           // NeuronWriter Guidelines (optional)
  locale?: string;
  brandVoice?: string;
  targetAudience?: string;
  additionalInstructions?: string;

  // Supabase Client (für ResearchPack)
  supabase?: SupabaseClient;

  // Quality Thresholds
  minLocalScore?: number;       // Default: 70
  minNwScore?: number;          // Default: 60
  maxRetries?: number;          // Default: 2
  requireNwValidation?: boolean; // Default: false (nur am Ende)

  // Callbacks für Progress-Updates
  onProgress?: (progress: GenerationProgress) => void;
}

export interface GenerationProgress {
  phase: 'research' | 'outline' | 'writing' | 'review' | 'finalizing';
  currentSection?: number;
  totalSections?: number;
  sectionName?: string;
  attempt?: number;
  message: string;
}

export interface GenerationResult {
  success: boolean;
  markdown?: string;
  html?: string;

  // Metadata
  outline?: Outline;
  researchPack?: ResearchPack;
  wordCount?: number;

  // Quality Metrics
  finalScore?: number;
  localScore?: number;
  nwScore?: number;

  // Stats
  totalRetries?: number;
  sectionsGenerated?: number;

  // Bei Fehlern
  error?: string;
  partialContent?: string;
}

// ============================================================================
// GENERATION LOOP
// ============================================================================

/**
 * Hauptfunktion: Generiert einen kompletten Artikel mit Quality Control
 */
export async function generateArticle(
  config: GenerationConfig
): Promise<GenerationResult> {
  const {
    projectId,
    keyword,
    nwQueryId,
    nwGuidelines,
    locale = "de-DE",
    brandVoice,
    targetAudience,
    additionalInstructions,
    supabase,
    minLocalScore = 70,
    minNwScore = 60,
    maxRetries = 2,
    requireNwValidation = false,
    onProgress,
  } = config;

  const progress = (update: Partial<GenerationProgress>) => {
    if (onProgress) {
      onProgress({
        phase: 'research',
        message: '',
        ...update,
      });
    }
  };

  let totalRetries = 0;

  try {
    // =========================================================================
    // PHASE 1: Research Pack erstellen
    // =========================================================================
    progress({ phase: 'research', message: 'Sammle Recherche-Daten...' });
    console.log(`[GenerationLoop] Starting article generation for: "${keyword}"`);

    const researchPackOptions: BuildResearchPackOptions = {
      keyword,
      locale,
      nwGuidelines,
      projectId,
    };

    const researchPack = await buildResearchPack(researchPackOptions, supabase);
    console.log(`[GenerationLoop] ResearchPack ready: ${researchPack.keywords.primary.length} primary, ${researchPack.keywords.secondary.length} secondary keywords`);

    // =========================================================================
    // PHASE 2: Outline generieren
    // =========================================================================
    progress({ phase: 'outline', message: 'Erstelle Artikel-Struktur...' });

    let outline: Outline;
    try {
      outline = await generateOutline(researchPack, {
        brandVoice,
        targetAudience,
        additionalInstructions,
      });
    } catch (err) {
      console.warn(`[GenerationLoop] LLM outline failed, using basic outline:`, err);
      outline = createBasicOutline(researchPack);
    }

    console.log(`[GenerationLoop] Outline ready: ${outline.sections.length} sections, ${outline.totalWordCount} target words`);

    // =========================================================================
    // PHASE 3: Quality Controller initialisieren
    // =========================================================================
    const qc = new QualityController(researchPack, {
      nwQueryId,
      minLocalScore,
      minNwScore,
      requireNwValidation: false, // NW nur am Ende
    });

    // =========================================================================
    // PHASE 4: Intro schreiben
    // =========================================================================
    progress({ phase: 'writing', message: 'Schreibe Einleitung...', currentSection: 0, totalSections: outline.sections.length + 2 });

    const intro = await writeIntroSection(outline, researchPack, { brandVoice });
    console.log(`[GenerationLoop] Intro written`);

    // =========================================================================
    // PHASE 5: Sections schreiben (mit Quality Loop)
    // =========================================================================
    const sectionDrafts: SectionDraft[] = [];
    const sectionContext: SectionContext = {
      previousSections: [],
      outline,
      researchPack,
      brandVoice,
    };

    for (const section of outline.sections) {
      progress({
        phase: 'writing',
        message: `Schreibe: ${section.headingText}`,
        currentSection: section.index + 1,
        totalSections: outline.sections.length,
        sectionName: section.headingText,
      });

      let draft = await writeSection(section, sectionContext);
      let attempt = 1;

      // Quality Check Loop
      while (attempt <= maxRetries + 1) {
        progress({
          phase: 'review',
          message: `Prüfe Qualität: ${section.headingText}`,
          currentSection: section.index + 1,
          totalSections: outline.sections.length,
          attempt,
        });

        const qaResult = await qc.reviewSection(draft, section);

        if (qaResult.passed) {
          console.log(`[GenerationLoop] Section ${section.index} passed (score: ${qaResult.score}%, attempt: ${attempt})`);
          break;
        }

        if (attempt > maxRetries) {
          // Max Retries erreicht, akzeptiere Draft trotzdem
          console.warn(`[GenerationLoop] Section ${section.index} failed after ${maxRetries} retries, accepting anyway`);
          break;
        }

        // Fix versuchen
        console.log(`[GenerationLoop] Section ${section.index} failed (score: ${qaResult.score}%), fixing... (attempt ${attempt})`);
        totalRetries++;

        const fixedContent = await fixSection(draft, qaResult, section, researchPack);
        draft = {
          ...draft,
          content: fixedContent,
          wordCount: countWords(fixedContent),
          keywordsUsed: extractUsedKeywords(fixedContent, section.plannedKeywords),
        };

        attempt++;
      }

      sectionDrafts.push(draft);
      sectionContext.previousSections.push(draft);
    }

    // =========================================================================
    // PHASE 6: FAQ schreiben (optional)
    // =========================================================================
    let faq: string | undefined;
    if (outline.faqQuestions.length > 0) {
      progress({ phase: 'writing', message: 'Schreibe FAQ-Bereich...' });
      faq = await writeFaqSection(outline.faqQuestions, researchPack);
      console.log(`[GenerationLoop] FAQ written with ${outline.faqQuestions.length} questions`);
    }

    // =========================================================================
    // PHASE 7: Zusammenfügen
    // =========================================================================
    progress({ phase: 'finalizing', message: 'Füge Artikel zusammen...' });

    const markdown = assembleSections(intro, sectionDrafts, faq);
    const wordCount = countWords(markdown);

    console.log(`[GenerationLoop] Article assembled: ${wordCount} words`);

    // =========================================================================
    // PHASE 8: Finale Qualitätsprüfung
    // =========================================================================
    progress({ phase: 'finalizing', message: 'Finale Qualitätsprüfung...' });

    const finalQA = await qc.reviewFullArticle(markdown, {
      includeNwScore: requireNwValidation && !!nwQueryId,
    });

    console.log(`[GenerationLoop] Final QA: score=${finalQA.score}%, passed=${finalQA.passed}, nwScore=${finalQA.nwScore || 'N/A'}`);

    // =========================================================================
    // ERGEBNIS
    // =========================================================================
    return {
      success: true,
      markdown,
      outline,
      researchPack,
      wordCount,
      finalScore: finalQA.score,
      localScore: finalQA.localScore,
      nwScore: finalQA.nwScore,
      totalRetries,
      sectionsGenerated: sectionDrafts.length,
    };

  } catch (error) {
    console.error(`[GenerationLoop] Error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// SECTION FIXER
// ============================================================================

/**
 * Versucht eine fehlerhafte Section zu verbessern
 */
async function fixSection(
  draft: SectionDraft,
  qaResult: QAResult,
  section: { headingText: string; plannedKeywords: string[] },
  researchPack: ResearchPack
): Promise<string> {
  const fixPrompt = generateFixPrompt(draft, qaResult);

  const systemPrompt = `Du bist ein SEO-Editor. Verbessere den Text basierend auf den Anweisungen.
- Schreibe NUR den verbesserten Inhalt
- KEIN JSON, KEINE Überschrift
- Baue die fehlenden Keywords natürlich ein`;

  const modelConfig = routeToModel("section_writing", fixPrompt, {
    targetLength: draft.wordCount + 50,
  });

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
        { role: "user", content: fixPrompt },
      ],
      temperature: 0.6,
      max_tokens: modelConfig.maxTokens,
    }),
  });

  if (!response.ok) {
    console.warn(`[FixSection] API error, keeping original`);
    return draft.content;
  }

  const data = await response.json();
  const fixedContent = data.choices?.[0]?.message?.content;

  if (!fixedContent || fixedContent.length < draft.content.length * 0.5) {
    // Fix zu kurz, behalte Original
    return draft.content;
  }

  return fixedContent.trim();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function countWords(text: string): number {
  return text
    .replace(/[#*_\[\]()>`-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
}

function extractUsedKeywords(text: string, keywords: string[]): string[] {
  const textLower = text.toLowerCase();
  return keywords.filter(kw => textLower.includes(kw.toLowerCase()));
}

// ============================================================================
// SIMPLIFIED QUICK GENERATION (für schnelle Tests)
// ============================================================================

/**
 * Vereinfachte Generierung ohne Quality Loop (für schnelle Tests)
 */
export async function generateArticleQuick(
  projectId: string,
  keyword: string,
  options: {
    nwQueryId?: string;
    locale?: string;
    brandVoice?: string;
  } = {}
): Promise<GenerationResult> {
  return generateArticle({
    projectId,
    keyword,
    nwQueryId: options.nwQueryId,
    locale: options.locale || "de-DE",
    brandVoice: options.brandVoice,
    maxRetries: 0, // Keine Retries
    requireNwValidation: false,
  });
}

// ============================================================================
// STREAMING GENERATION (für UI-Feedback)
// ============================================================================

/**
 * Generator für Streaming-Updates
 */
export async function* generateArticleStream(
  config: GenerationConfig
): AsyncGenerator<GenerationProgress, GenerationResult, unknown> {
  const progressUpdates: GenerationProgress[] = [];

  const result = await generateArticle({
    ...config,
    onProgress: (progress) => {
      progressUpdates.push(progress);
    },
  });

  // Yield alle gesammelten Progress-Updates
  for (const update of progressUpdates) {
    yield update;
  }

  return result;
}
