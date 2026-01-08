// supabase/functions/_shared/researchPack.ts
// Research Pack - Strukturierte Datensammlung für Content-Generierung
// Basierend auf Plan Phase 2: Data Collection

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrichKeyword, KeywordData } from "./keyword-research.ts";

// ============================================================================
// INTERFACES
// ============================================================================

export interface KeywordRequirement {
  term: string;
  count: number;        // Wie oft soll es vorkommen
  importance: number;   // 0-100 Priorität
}

export interface CompetitorAnalysis {
  url: string;
  title: string;
  snippet: string;
  position: number;
  wordCount?: number;
  headingCount?: { h1: number; h2: number; h3: number };
}

export interface SearchIntent {
  primary: 'informational' | 'commercial' | 'transactional' | 'navigational';
  stage: 'unaware' | 'problem_aware' | 'solution_aware' | 'product_aware';
  confidence: number;
}

export interface KeywordBudget {
  title: KeywordRequirement[];
  h1: KeywordRequirement[];
  h2: KeywordRequirement[];
  h3: KeywordRequirement[];
  body: KeywordRequirement[];
}

export interface ContentRecommendations {
  wordCountRange: [number, number];
  headingCount: { h2: number; h3: number };
  imageCount: number;
  faqCount: number;
}

export interface ResearchPack {
  // Meta
  keyword: string;
  locale: string;
  createdAt: string;

  // Intent Analysis
  intent: SearchIntent;

  // SERP Data
  serp: {
    topResults: CompetitorAnalysis[];
    relatedSearches: string[];
    peopleAlsoAsk: string[];
    featuredSnippet?: string;
  };

  // Keyword Collections (für Content-Planung)
  keywords: {
    primary: string[];      // Hauptkeywords (in Title/H1)
    secondary: string[];    // Sekundäre Keywords (H2/Body)
    questions: string[];    // FAQ-fähige Fragen
    lsi: string[];          // Related Searches
  };

  // Requirements für KeywordTracker (mit Zählungen)
  requirements: KeywordBudget;

  // Recommendations
  recommendations: ContentRecommendations;

  // Site Context (für interne Verlinkung)
  siteContext?: {
    relevantPages: { url: string; title: string; similarity?: number }[];
  };

  // Raw Data (für Debugging)
  _raw?: {
    neuronwriter?: unknown;
    serper?: unknown;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Analysiert die Suchintention basierend auf Keyword-Mustern
 */
function analyzeIntent(keyword: string, serpData?: KeywordData['serp']): SearchIntent {
  const kw = keyword.toLowerCase();

  // Transactional indicators
  if (/\b(kaufen|bestellen|preis|kosten|günstig|shop|online)\b/.test(kw)) {
    return { primary: 'transactional', stage: 'product_aware', confidence: 0.8 };
  }

  // Commercial indicators
  if (/\b(vergleich|test|beste|review|erfahrung|bewertung|vs)\b/.test(kw)) {
    return { primary: 'commercial', stage: 'solution_aware', confidence: 0.8 };
  }

  // Navigational indicators
  if (/\b(login|anmelden|kontakt|support|download)\b/.test(kw)) {
    return { primary: 'navigational', stage: 'product_aware', confidence: 0.9 };
  }

  // Informational (default) - check for question words
  if (/\b(was|wie|warum|wann|wo|wer|welche|anleitung|tutorial|guide)\b/.test(kw)) {
    return { primary: 'informational', stage: 'problem_aware', confidence: 0.8 };
  }

  // Default: informational
  return { primary: 'informational', stage: 'problem_aware', confidence: 0.5 };
}

/**
 * Transformiert NeuronWriter Daten in KeywordBudget Struktur
 */
function transformNWToRequirements(nwGuidelines: any): KeywordBudget {
  const budget: KeywordBudget = {
    title: [],
    h1: [],
    h2: [],
    h3: [],
    body: [],
  };

  if (!nwGuidelines?.terms) return budget;

  const terms = nwGuidelines.terms;

  // NeuronWriter liefert: title, h1, content_basic, content_extended
  // Die Struktur kann unterschiedlich sein (Array vs Object)

  if (Array.isArray(terms)) {
    // Neue Struktur: Array von {term, sugg_usage, in_title, in_h1}
    for (const t of terms) {
      const req: KeywordRequirement = {
        term: t.term,
        count: t.sugg_usage || 1,
        importance: t.importance || 50,
      };

      if (t.in_title) budget.title.push({ ...req, count: 1 });
      if (t.in_h1) budget.h1.push({ ...req, count: 1 });
      budget.body.push(req);
    }
  } else {
    // Alte Struktur: Object mit title, h1, content_basic, content_extended

    // Title Keywords
    if (terms.title) {
      for (const t of terms.title) {
        budget.title.push({
          term: t.t || t.term,
          count: 1,
          importance: 100,
        });
      }
    }

    // H1 Keywords
    if (terms.h1) {
      for (const t of terms.h1) {
        budget.h1.push({
          term: t.t || t.term,
          count: 1,
          importance: 90,
        });
      }
    }

    // Body Keywords (content_basic + content_extended)
    const basicTerms = terms.content_basic || [];
    const extendedTerms = terms.content_extended || [];

    for (const t of basicTerms) {
      const usage = Array.isArray(t.sugg_usage) ? t.sugg_usage[1] : (t.sugg_usage || 1);
      budget.body.push({
        term: t.t || t.term,
        count: usage,
        importance: 80,
      });
    }

    for (const t of extendedTerms) {
      const usage = Array.isArray(t.sugg_usage) ? t.sugg_usage[1] : (t.sugg_usage || 1);
      budget.body.push({
        term: t.t || t.term,
        count: usage,
        importance: 60,
      });
    }
  }

  // H2/H3 Keywords: Leite aus Body-Keywords mit hoher Importance ab
  const h2Candidates = budget.body
    .filter(k => k.importance >= 70)
    .slice(0, 5);

  for (const k of h2Candidates) {
    budget.h2.push({ ...k, count: 1 });
  }

  return budget;
}

/**
 * Extrahiert Recommendations aus NeuronWriter Metrics
 */
function extractRecommendations(nwGuidelines: any): ContentRecommendations {
  const metrics = nwGuidelines?.metrics;

  // Defaults
  let wordCountRange: [number, number] = [1200, 2000];
  let headingCount = { h2: 5, h3: 8 };
  let imageCount = 3;
  let faqCount = 5;

  if (metrics) {
    // Word count
    if (metrics.word_count?.target) {
      const target = metrics.word_count.target;
      wordCountRange = [Math.round(target * 0.9), Math.round(target * 1.1)];
    } else if (metrics.words_avg) {
      wordCountRange = [
        metrics.words_min || Math.round(metrics.words_avg * 0.9),
        metrics.words_max || Math.round(metrics.words_avg * 1.1)
      ];
    }

    // Headings
    if (metrics.headings_avg) {
      headingCount.h2 = Math.round(metrics.headings_avg * 0.6);
      headingCount.h3 = Math.round(metrics.headings_avg * 0.4);
    }

    // Images
    if (metrics.images_avg) {
      imageCount = Math.round(metrics.images_avg);
    }
  }

  // FAQs: Basierend auf verfügbaren Fragen
  const questions = nwGuidelines?.questions || nwGuidelines?.ideas?.suggest_questions || [];
  faqCount = Math.min(questions.length, 7);

  return { wordCountRange, headingCount, imageCount, faqCount };
}

// ============================================================================
// MAIN BUILDER
// ============================================================================

export interface BuildResearchPackOptions {
  keyword: string;
  locale?: string;
  nwGuidelines?: any;           // NeuronWriter Daten
  projectId?: string;           // Für Site Context (interne Links)
  skipSerp?: boolean;           // SERP-Abfrage überspringen
}

/**
 * Baut ein vollständiges ResearchPack aus allen verfügbaren Datenquellen
 */
export async function buildResearchPack(
  options: BuildResearchPackOptions,
  supabase?: SupabaseClient
): Promise<ResearchPack> {
  const { keyword, locale = 'de-DE', nwGuidelines, projectId, skipSerp = false } = options;

  console.log(`[ResearchPack] Building for keyword: "${keyword}"`);

  // 1. SERP Data (Serper.dev)
  let serpData: KeywordData = {};
  if (!skipSerp) {
    try {
      serpData = await enrichKeyword(keyword, supabase);
      console.log(`[ResearchPack] SERP data: ${serpData.serp?.topResults?.length || 0} results`);
    } catch (e) {
      console.warn(`[ResearchPack] SERP fetch failed:`, e);
    }
  }

  // 2. Intent Analysis
  const intent = analyzeIntent(keyword, serpData.serp);
  console.log(`[ResearchPack] Intent: ${intent.primary} (${intent.confidence * 100}%)`);

  // 3. Transform NeuronWriter to Requirements
  const requirements = transformNWToRequirements(nwGuidelines);
  console.log(`[ResearchPack] Requirements: ${requirements.body.length} body terms, ${requirements.title.length} title terms`);

  // 4. Extract Recommendations
  const recommendations = extractRecommendations(nwGuidelines);
  console.log(`[ResearchPack] Recommendations: ${recommendations.wordCountRange[0]}-${recommendations.wordCountRange[1]} words`);

  // 5. Build Keywords Collections
  const keywords = {
    primary: requirements.title.map(k => k.term),
    secondary: requirements.body.slice(0, 20).map(k => k.term),
    questions: extractQuestions(nwGuidelines, serpData),
    lsi: serpData.serp?.relatedSearches || [],
  };

  // 6. Site Context (wenn projectId vorhanden)
  let siteContext: ResearchPack['siteContext'] | undefined;
  if (projectId && supabase) {
    try {
      const { data: pages } = await supabase
        .from('pages')
        .select('url, title')
        .eq('project_id', projectId)
        .limit(20);

      if (pages && pages.length > 0) {
        siteContext = {
          relevantPages: pages.map(p => ({
            url: p.url,
            title: p.title || '',
          })),
        };
        console.log(`[ResearchPack] Site context: ${pages.length} pages`);
      }
    } catch (e) {
      console.warn(`[ResearchPack] Site context fetch failed:`, e);
    }
  }

  // 7. Build final ResearchPack
  const pack: ResearchPack = {
    keyword,
    locale,
    createdAt: new Date().toISOString(),
    intent,
    serp: {
      topResults: (serpData.serp?.topResults || []).map((r, i) => ({
        url: r.link,
        title: r.title,
        snippet: r.snippet,
        position: i + 1,
      })),
      relatedSearches: serpData.serp?.relatedSearches || [],
      peopleAlsoAsk: serpData.serp?.peopleAlsoAsk || [],
    },
    keywords,
    requirements,
    recommendations,
    siteContext,
    _raw: {
      neuronwriter: nwGuidelines,
      serper: serpData,
    },
  };

  console.log(`[ResearchPack] Built successfully`);
  return pack;
}

/**
 * Extrahiert Fragen aus NeuronWriter und SERP Daten
 */
function extractQuestions(nwGuidelines: any, serpData: KeywordData): string[] {
  const questions: string[] = [];

  // NeuronWriter Fragen
  if (nwGuidelines?.questions) {
    questions.push(...nwGuidelines.questions);
  }
  if (nwGuidelines?.ideas?.suggest_questions) {
    questions.push(...nwGuidelines.ideas.suggest_questions.map((q: any) => q.q || q));
  }
  if (nwGuidelines?.ideas?.people_also_ask) {
    questions.push(...nwGuidelines.ideas.people_also_ask.map((q: any) => q.q || q));
  }
  if (nwGuidelines?.ideas?.content_questions) {
    questions.push(...nwGuidelines.ideas.content_questions.map((q: any) => q.q || q));
  }

  // SERP People Also Ask
  if (serpData.serp?.peopleAlsoAsk) {
    questions.push(...serpData.serp.peopleAlsoAsk);
  }

  // Deduplicate
  return [...new Set(questions)].slice(0, 15);
}

// ============================================================================
// ARTIFACT STORAGE
// ============================================================================

/**
 * Speichert ResearchPack als Artifact in der Datenbank
 */
export async function saveResearchPackArtifact(
  supabase: SupabaseClient,
  runId: string,
  pack: ResearchPack
): Promise<void> {
  await supabase.from('artifacts').insert({
    run_id: runId,
    type: 'research_pack',
    version: 1,
    content: pack,
  });

  console.log(`[ResearchPack] Saved as artifact for run ${runId}`);
}

/**
 * Lädt ResearchPack Artifact aus der Datenbank
 */
export async function loadResearchPackArtifact(
  supabase: SupabaseClient,
  runId: string
): Promise<ResearchPack | null> {
  const { data } = await supabase
    .from('artifacts')
    .select('content')
    .eq('run_id', runId)
    .eq('type', 'research_pack')
    .order('version', { ascending: false })
    .limit(1)
    .single();

  return data?.content as ResearchPack || null;
}
