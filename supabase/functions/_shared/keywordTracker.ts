// supabase/functions/_shared/keywordTracker.ts
// KeywordTracker - Trackt Keyword-Nutzung und validiert gegen NeuronWriter
// Plan Phase 3.1: Keyword Tracking System

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ResearchPack, KeywordRequirement, KeywordBudget } from "./researchPack.ts";

// ============================================================================
// INTERFACES
// ============================================================================

export interface KeywordUsage {
  term: string;
  location: 'title' | 'h1' | 'h2' | 'h3' | 'body';
  required: number;
  used: number;
  remaining: number;
  satisfied: boolean;
}

export interface TrackingResult {
  location: string;
  usages: KeywordUsage[];
  localScore: number;        // 0-100 basierend auf lokalem Counting
  allRequirementsMet: boolean;
}

export interface NWEvaluationResult {
  score: number;             // 0-100 NeuronWriter Score
  status: 'ok' | 'error';
  error?: string;
}

export interface ComplianceReport {
  localScore: number;        // Lokale Berechnung
  nwScore?: number;          // NeuronWriter Score (optional)
  overallSatisfied: boolean;
  byLocation: {
    title: KeywordUsage[];
    h1: KeywordUsage[];
    h2: KeywordUsage[];
    h3: KeywordUsage[];
    body: KeywordUsage[];
  };
  missing: KeywordUsage[];   // Keywords die fehlen
  suggestions: string[];     // Verbesserungsvorschläge
}

// ============================================================================
// KEYWORD TRACKER CLASS
// ============================================================================

export class KeywordTracker {
  private budget: KeywordBudget;
  private usageByLocation: Map<string, Map<string, number>>;
  private nwQueryId?: string;

  constructor(requirements: KeywordBudget, nwQueryId?: string) {
    this.budget = requirements;
    this.nwQueryId = nwQueryId;
    this.usageByLocation = new Map([
      ['title', new Map()],
      ['h1', new Map()],
      ['h2', new Map()],
      ['h3', new Map()],
      ['body', new Map()],
    ]);
  }

  /**
   * Factory: Erstellt KeywordTracker aus ResearchPack
   */
  static fromResearchPack(pack: ResearchPack, nwQueryId?: string): KeywordTracker {
    return new KeywordTracker(pack.requirements, nwQueryId);
  }

  /**
   * Zählt Keywords in einem Text für eine bestimmte Location
   */
  checkUsage(text: string, location: 'title' | 'h1' | 'h2' | 'h3' | 'body'): TrackingResult {
    const requirements = this.budget[location];
    const locationUsage = this.usageByLocation.get(location)!;
    const usages: KeywordUsage[] = [];
    const textLower = text.toLowerCase();

    for (const req of requirements) {
      const termLower = req.term.toLowerCase();
      const count = this.countOccurrences(textLower, termLower);

      // Update tracking
      const previousCount = locationUsage.get(req.term) || 0;
      locationUsage.set(req.term, previousCount + count);

      const totalUsed = previousCount + count;
      const usage: KeywordUsage = {
        term: req.term,
        location,
        required: req.count,
        used: totalUsed,
        remaining: Math.max(0, req.count - totalUsed),
        satisfied: totalUsed >= req.count,
      };
      usages.push(usage);
    }

    // Berechne lokalen Score für diese Location
    const satisfiedCount = usages.filter(u => u.satisfied).length;
    const localScore = requirements.length > 0
      ? Math.round((satisfiedCount / requirements.length) * 100)
      : 100;

    return {
      location,
      usages,
      localScore,
      allRequirementsMet: usages.every(u => u.satisfied),
    };
  }

  /**
   * Analysiert Markdown-Content und trackt alle Locations automatisch
   */
  analyzeMarkdown(markdown: string): ComplianceReport {
    // Reset usage tracking
    this.resetUsage();

    // Parse Markdown und extrahiere Locations
    const parsed = this.parseMarkdownLocations(markdown);

    // Track jede Location
    if (parsed.title) this.checkUsage(parsed.title, 'title');
    if (parsed.h1) this.checkUsage(parsed.h1, 'h1');
    for (const h2 of parsed.h2s) this.checkUsage(h2, 'h2');
    for (const h3 of parsed.h3s) this.checkUsage(h3, 'h3');
    this.checkUsage(parsed.bodyText, 'body');

    return this.getComplianceReport();
  }

  /**
   * Gibt Keyword-Vorschläge für eine Section zurück
   */
  getSuggestionsForSection(sectionIndex: number, totalSections: number): string[] {
    const suggestions: string[] = [];
    const remainingBudget = this.getRemainingBudget();

    // Verteile verbleibende Keywords auf verbleibende Sections
    const remainingSections = totalSections - sectionIndex;

    // H2 Keywords (eine pro Section empfohlen)
    const h2Remaining = remainingBudget.h2.filter(k => k.remaining > 0);
    if (h2Remaining.length > 0 && sectionIndex < h2Remaining.length) {
      suggestions.push(`H2: Verwende "${h2Remaining[sectionIndex % h2Remaining.length].term}" in der Überschrift`);
    }

    // Body Keywords (verteilt auf Sections)
    const bodyRemaining = remainingBudget.body.filter(k => k.remaining > 0);
    const keywordsPerSection = Math.ceil(bodyRemaining.length / Math.max(remainingSections, 1));
    const startIdx = sectionIndex * keywordsPerSection;
    const sectionKeywords = bodyRemaining.slice(startIdx, startIdx + keywordsPerSection);

    for (const kw of sectionKeywords.slice(0, 5)) { // Max 5 Vorschläge
      suggestions.push(`Body: "${kw.term}" (noch ${kw.remaining}x benötigt)`);
    }

    return suggestions;
  }

  /**
   * Gibt den aktuellen Compliance-Report zurück
   */
  getComplianceReport(): ComplianceReport {
    const byLocation = {
      title: this.getUsageForLocation('title'),
      h1: this.getUsageForLocation('h1'),
      h2: this.getUsageForLocation('h2'),
      h3: this.getUsageForLocation('h3'),
      body: this.getUsageForLocation('body'),
    };

    const allUsages = [
      ...byLocation.title,
      ...byLocation.h1,
      ...byLocation.h2,
      ...byLocation.h3,
      ...byLocation.body,
    ];

    const missing = allUsages.filter(u => !u.satisfied);
    const localScore = this.calculateLocalScore(allUsages);

    const suggestions: string[] = [];

    // Generiere Vorschläge für fehlende Keywords
    const missingTitle = byLocation.title.filter(u => !u.satisfied);
    const missingH1 = byLocation.h1.filter(u => !u.satisfied);
    const missingBody = byLocation.body.filter(u => !u.satisfied).slice(0, 5);

    if (missingTitle.length > 0) {
      suggestions.push(`Title: Füge hinzu: ${missingTitle.map(u => u.term).join(', ')}`);
    }
    if (missingH1.length > 0) {
      suggestions.push(`H1: Füge hinzu: ${missingH1.map(u => u.term).join(', ')}`);
    }
    for (const m of missingBody) {
      suggestions.push(`Body: "${m.term}" noch ${m.remaining}x verwenden`);
    }

    return {
      localScore,
      overallSatisfied: missing.length === 0,
      byLocation,
      missing,
      suggestions,
    };
  }

  /**
   * Berechnet den lokalen Compliance-Score (0-100)
   */
  getLocalScore(): number {
    const report = this.getComplianceReport();
    return report.localScore;
  }

  /**
   * Gibt verbleibendes Budget zurück
   */
  getRemainingBudget(): KeywordBudget {
    return {
      title: this.getUsageForLocation('title'),
      h1: this.getUsageForLocation('h1'),
      h2: this.getUsageForLocation('h2'),
      h3: this.getUsageForLocation('h3'),
      body: this.getUsageForLocation('body'),
    };
  }

  /**
   * Setzt das Usage-Tracking zurück
   */
  resetUsage(): void {
    for (const [, map] of this.usageByLocation) {
      map.clear();
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private countOccurrences(text: string, term: string): number {
    // Case-insensitive word boundary matching
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  }

  private parseMarkdownLocations(markdown: string): {
    title: string;
    h1: string;
    h2s: string[];
    h3s: string[];
    bodyText: string;
  } {
    const lines = markdown.split('\n');
    let title = '';
    let h1 = '';
    const h2s: string[] = [];
    const h3s: string[] = [];
    const bodyLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('# ')) {
        h1 = trimmed.replace(/^# /, '');
        if (!title) title = h1; // H1 als Title fallback
      } else if (trimmed.startsWith('## ')) {
        h2s.push(trimmed.replace(/^## /, ''));
      } else if (trimmed.startsWith('### ')) {
        h3s.push(trimmed.replace(/^### /, ''));
      } else if (trimmed && !trimmed.startsWith('#')) {
        // Nicht-Heading Content
        bodyLines.push(trimmed);
      }
    }

    return {
      title,
      h1,
      h2s,
      h3s,
      bodyText: bodyLines.join(' '),
    };
  }

  private getUsageForLocation(location: string): KeywordUsage[] {
    const requirements = this.budget[location as keyof KeywordBudget] || [];
    const locationUsage = this.usageByLocation.get(location)!;

    return requirements.map(req => {
      const used = locationUsage.get(req.term) || 0;
      return {
        term: req.term,
        location: location as KeywordUsage['location'],
        required: req.count,
        used,
        remaining: Math.max(0, req.count - used),
        satisfied: used >= req.count,
      };
    });
  }

  private calculateLocalScore(usages: KeywordUsage[]): number {
    if (usages.length === 0) return 100;

    // Gewichtete Berechnung
    let totalWeight = 0;
    let satisfiedWeight = 0;

    for (const usage of usages) {
      // Title und H1 sind wichtiger
      const weight = usage.location === 'title' ? 3
                   : usage.location === 'h1' ? 2.5
                   : usage.location === 'h2' ? 2
                   : usage.location === 'h3' ? 1.5
                   : 1;

      totalWeight += weight;
      if (usage.satisfied) {
        satisfiedWeight += weight;
      } else {
        // Partial credit für teilweise erfüllte Requirements
        const partialCredit = Math.min(usage.used / usage.required, 1);
        satisfiedWeight += weight * partialCredit;
      }
    }

    return Math.round((satisfiedWeight / totalWeight) * 100);
  }
}

// ============================================================================
// NEURONWRITER EVALUATION
// ============================================================================

const NW_BASE_URL = "https://app.neuronwriter.com/neuron-api/0.5/writer";

/**
 * Evaluiert Content mit NeuronWriter API (ohne zu speichern)
 */
export async function evaluateWithNeuronWriter(
  queryId: string,
  content: {
    html?: string;
    title?: string;
    description?: string;
  }
): Promise<NWEvaluationResult> {
  const apiKey = Deno.env.get("NEURONWRITER_API_KEY");

  if (!apiKey) {
    return { score: 0, status: 'error', error: 'NEURONWRITER_API_KEY not configured' };
  }

  if (!content.html) {
    return { score: 0, status: 'error', error: 'HTML content required' };
  }

  try {
    const response = await fetch(`${NW_BASE_URL}/evaluate-content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        query: queryId,
        html: content.html,
        title: content.title,
        description: content.description,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[NW Evaluate] API error:", errorText);
      return { score: 0, status: 'error', error: `API Error: ${response.status}` };
    }

    const data = await response.json();
    console.log("[NW Evaluate] Score:", data.content_score);

    return {
      score: data.content_score || 0,
      status: 'ok',
    };
  } catch (e) {
    console.error("[NW Evaluate] Exception:", e);
    return { score: 0, status: 'error', error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Konvertiert Markdown zu HTML für NeuronWriter Evaluation
 */
export function markdownToSimpleHtml(markdown: string): string {
  let html = markdown
    // Headings
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold & Italic
    .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Lists
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    // Paragraphs
    .replace(/\n\n/gim, '</p><p>')
    // Blockquotes
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Links
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>');

  // Wrap in paragraph if not starting with tag
  if (!html.startsWith('<')) {
    html = '<p>' + html + '</p>';
  }

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>\s*)+/gim, '<ul>$&</ul>');

  return html;
}

/**
 * Kombinierter Check: Lokal + NeuronWriter
 */
export async function validateContent(
  tracker: KeywordTracker,
  markdown: string,
  nwQueryId?: string,
  options: {
    requireNwScore?: boolean;
    minNwScore?: number;
    minLocalScore?: number;
  } = {}
): Promise<{
  passed: boolean;
  localScore: number;
  nwScore?: number;
  report: ComplianceReport;
}> {
  const { requireNwScore = false, minNwScore = 70, minLocalScore = 80 } = options;

  // 1. Lokale Analyse
  const report = tracker.analyzeMarkdown(markdown);
  const localScore = report.localScore;

  // 2. NeuronWriter Score (wenn queryId vorhanden und gewünscht)
  let nwScore: number | undefined;
  if (nwQueryId && (requireNwScore || localScore >= minLocalScore)) {
    const html = markdownToSimpleHtml(markdown);
    const nwResult = await evaluateWithNeuronWriter(nwQueryId, { html });
    if (nwResult.status === 'ok') {
      nwScore = nwResult.score;
      report.nwScore = nwScore;
    }
  }

  // 3. Bestimme ob passed
  const localPassed = localScore >= minLocalScore;
  const nwPassed = !requireNwScore || (nwScore !== undefined && nwScore >= minNwScore);
  const passed = localPassed && nwPassed;

  return {
    passed,
    localScore,
    nwScore,
    report,
  };
}
