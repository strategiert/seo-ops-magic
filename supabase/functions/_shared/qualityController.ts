// supabase/functions/_shared/qualityController.ts
// Quality Controller - Prüft und bewertet Content-Qualität
// Plan Phase 3.4: Quality Controller

import {
  KeywordTracker,
  validateContent,
  markdownToSimpleHtml,
  evaluateWithNeuronWriter,
  type ComplianceReport,
} from "./keywordTracker.ts";
import type { SectionDraft } from "./sectionWriter.ts";
import type { Section } from "./outlineGenerator.ts";
import type { ResearchPack } from "./researchPack.ts";

// ============================================================================
// INTERFACES
// ============================================================================

export interface QualityIssue {
  type: 'missing_keyword' | 'too_short' | 'too_long' | 'off_topic' | 'low_score' | 'weak_structure';
  severity: 'error' | 'warning';
  message: string;
  suggestion: string;
  details?: Record<string, unknown>;
}

export interface QAResult {
  passed: boolean;
  score: number;               // 0-100 kombinierter Score
  localScore: number;          // Lokaler Keyword-Score
  nwScore?: number;            // NeuronWriter Score (wenn verfügbar)
  issues: QualityIssue[];
  suggestions: string[];       // Verbesserungsvorschläge für Fixer
}

export interface QualityThresholds {
  minLocalScore: number;       // Minimum lokaler Score (default: 70)
  minNwScore: number;          // Minimum NW Score (default: 60)
  minWordCount: number;        // Minimum Wörter pro Section
  maxWordCount: number;        // Maximum Wörter pro Section (Überschreitung = Warning)
  requireNwValidation: boolean; // NW Score prüfen?
}

const DEFAULT_THRESHOLDS: QualityThresholds = {
  minLocalScore: 70,
  minNwScore: 60,
  minWordCount: 100,
  maxWordCount: 800,
  requireNwValidation: false,  // Standard: nur lokal prüfen (schneller, günstiger)
};

// ============================================================================
// QUALITY CONTROLLER CLASS
// ============================================================================

export class QualityController {
  private tracker: KeywordTracker;
  private thresholds: QualityThresholds;
  private nwQueryId?: string;

  constructor(
    researchPack: ResearchPack,
    options: Partial<QualityThresholds> & { nwQueryId?: string } = {}
  ) {
    this.tracker = KeywordTracker.fromResearchPack(researchPack, options.nwQueryId);
    this.nwQueryId = options.nwQueryId;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options };
  }

  /**
   * Prüft eine einzelne Section
   */
  async reviewSection(
    draft: SectionDraft,
    expectedSection: Section
  ): Promise<QAResult> {
    const issues: QualityIssue[] = [];
    const suggestions: string[] = [];

    // 1. Wortanzahl prüfen
    const wordCountIssues = this.checkWordCount(draft, expectedSection);
    issues.push(...wordCountIssues);

    // 2. Keyword-Nutzung prüfen (lokal)
    const fullContent = `## ${draft.heading}\n\n${draft.content}`;
    const trackingResult = this.tracker.checkUsage(fullContent, 'body');

    // Prüfe auch Heading-Keywords
    if (draft.headingType === 'h2') {
      this.tracker.checkUsage(draft.heading, 'h2');
    } else if (draft.headingType === 'h3') {
      this.tracker.checkUsage(draft.heading, 'h3');
    }

    // 3. Fehlende geplante Keywords
    const missingKeywords = expectedSection.plannedKeywords.filter(
      kw => !draft.keywordsUsed.includes(kw)
    );

    if (missingKeywords.length > 0) {
      issues.push({
        type: 'missing_keyword',
        severity: missingKeywords.length > 2 ? 'error' : 'warning',
        message: `${missingKeywords.length} geplante Keywords fehlen`,
        suggestion: `Füge ein: ${missingKeywords.join(', ')}`,
        details: { missingKeywords },
      });

      suggestions.push(`Baue folgende Keywords natürlich ein: ${missingKeywords.join(', ')}`);
    }

    // 4. Lokaler Score
    const localScore = trackingResult.localScore;

    if (localScore < this.thresholds.minLocalScore) {
      issues.push({
        type: 'low_score',
        severity: localScore < 50 ? 'error' : 'warning',
        message: `Lokaler Keyword-Score zu niedrig: ${localScore}%`,
        suggestion: 'Mehr relevante Keywords einbauen',
      });
    }

    // 5. Berechne Gesamt-Score
    const passed = issues.filter(i => i.severity === 'error').length === 0 &&
                   localScore >= this.thresholds.minLocalScore;

    return {
      passed,
      score: localScore,
      localScore,
      issues,
      suggestions,
    };
  }

  /**
   * Prüft den gesamten Artikel (nach Fertigstellung aller Sections)
   */
  async reviewFullArticle(
    markdown: string,
    options: { includeNwScore?: boolean } = {}
  ): Promise<QAResult> {
    const issues: QualityIssue[] = [];
    const suggestions: string[] = [];

    // 1. Lokale Analyse
    const report = this.tracker.analyzeMarkdown(markdown);

    // 2. NeuronWriter Score (optional)
    let nwScore: number | undefined;
    if ((options.includeNwScore || this.thresholds.requireNwValidation) && this.nwQueryId) {
      const html = markdownToSimpleHtml(markdown);
      const nwResult = await evaluateWithNeuronWriter(this.nwQueryId, { html });

      if (nwResult.status === 'ok') {
        nwScore = nwResult.score;

        if (nwScore < this.thresholds.minNwScore) {
          issues.push({
            type: 'low_score',
            severity: nwScore < 40 ? 'error' : 'warning',
            message: `NeuronWriter Score zu niedrig: ${nwScore}%`,
            suggestion: 'Mehr NLP-Keywords einbauen, Struktur verbessern',
          });
        }
      }
    }

    // 3. Fehlende Keywords sammeln
    for (const missing of report.missing) {
      if (missing.remaining > 0) {
        issues.push({
          type: 'missing_keyword',
          severity: missing.location === 'title' || missing.location === 'h1' ? 'error' : 'warning',
          message: `"${missing.term}" fehlt in ${missing.location.toUpperCase()} (${missing.remaining}x)`,
          suggestion: `"${missing.term}" in ${missing.location} einbauen`,
        });
      }
    }

    // 4. Vorschläge übernehmen
    suggestions.push(...report.suggestions);

    // 5. Gesamt-Score berechnen
    const combinedScore = nwScore !== undefined
      ? Math.round((report.localScore * 0.4 + nwScore * 0.6))
      : report.localScore;

    const minRequired = nwScore !== undefined
      ? this.thresholds.minNwScore
      : this.thresholds.minLocalScore;

    const passed = issues.filter(i => i.severity === 'error').length === 0 &&
                   combinedScore >= minRequired;

    return {
      passed,
      score: combinedScore,
      localScore: report.localScore,
      nwScore,
      issues,
      suggestions,
    };
  }

  /**
   * Schneller Check ob eine Section die Mindestanforderungen erfüllt
   */
  quickCheck(draft: SectionDraft, expectedSection: Section): boolean {
    // Wortanzahl OK?
    if (draft.wordCount < this.thresholds.minWordCount * 0.8) return false;

    // Mindestens 50% der geplanten Keywords verwendet?
    const usedCount = expectedSection.plannedKeywords.filter(
      kw => draft.keywordsUsed.includes(kw)
    ).length;
    const requiredCount = Math.ceil(expectedSection.plannedKeywords.length * 0.5);

    return usedCount >= requiredCount;
  }

  /**
   * Gibt Vorschläge für Section-Verbesserung
   */
  getFixSuggestions(qaResult: QAResult): string[] {
    const suggestions: string[] = [];

    for (const issue of qaResult.issues) {
      if (issue.severity === 'error') {
        suggestions.push(`[FEHLER] ${issue.suggestion}`);
      }
    }

    for (const issue of qaResult.issues) {
      if (issue.severity === 'warning') {
        suggestions.push(`[WARNUNG] ${issue.suggestion}`);
      }
    }

    return suggestions;
  }

  /**
   * Getter für den internen KeywordTracker
   */
  getTracker(): KeywordTracker {
    return this.tracker;
  }

  /**
   * Getter für Compliance Report
   */
  getComplianceReport(): ComplianceReport {
    return this.tracker.getComplianceReport();
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private checkWordCount(draft: SectionDraft, expected: Section): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const target = expected.targetWordCount;
    const actual = draft.wordCount;

    // Zu kurz?
    if (actual < this.thresholds.minWordCount) {
      issues.push({
        type: 'too_short',
        severity: 'error',
        message: `Section zu kurz: ${actual} Wörter (Minimum: ${this.thresholds.minWordCount})`,
        suggestion: `Erweitere den Abschnitt um mindestens ${this.thresholds.minWordCount - actual} Wörter`,
      });
    } else if (actual < target * 0.7) {
      issues.push({
        type: 'too_short',
        severity: 'warning',
        message: `Section unter Ziel: ${actual}/${target} Wörter`,
        suggestion: `Erweitere den Abschnitt um ca. ${target - actual} Wörter`,
      });
    }

    // Zu lang?
    if (actual > this.thresholds.maxWordCount) {
      issues.push({
        type: 'too_long',
        severity: 'warning',
        message: `Section sehr lang: ${actual} Wörter (empfohlen max: ${this.thresholds.maxWordCount})`,
        suggestion: 'Erwäge Aufteilung in Unterabschnitte',
      });
    }

    return issues;
  }
}

// ============================================================================
// SECTION FIXER
// ============================================================================

/**
 * Generiert einen Fix-Prompt für eine fehlerhafte Section
 */
export function generateFixPrompt(
  originalDraft: SectionDraft,
  qaResult: QAResult
): string {
  const fixInstructions: string[] = [];

  for (const issue of qaResult.issues) {
    switch (issue.type) {
      case 'missing_keyword':
        fixInstructions.push(`- Füge folgende Keywords natürlich ein: ${issue.details?.missingKeywords || 'siehe Vorschläge'}`);
        break;
      case 'too_short':
        fixInstructions.push(`- Erweitere den Text um mehr Details und Beispiele`);
        break;
      case 'too_long':
        fixInstructions.push(`- Kürze den Text oder teile ihn in Unterabschnitte`);
        break;
      case 'low_score':
        fixInstructions.push(`- Verbessere die Keyword-Dichte und -Verteilung`);
        break;
    }
  }

  return `Verbessere diesen Abschnitt:

## Original
${originalDraft.content}

## Probleme
${qaResult.issues.map(i => `- ${i.message}`).join('\n')}

## Anweisungen zur Verbesserung
${fixInstructions.join('\n')}

Schreibe den verbesserten Abschnitt (NUR den Inhalt, KEINE Überschrift):`;
}
