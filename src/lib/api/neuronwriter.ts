import { supabase } from "@/integrations/supabase/client";

export interface NWProject {
  id: string;
  name: string;
  lang?: string;
  country?: string;
}

export interface NWQuery {
  id: string;
  query: string;
  status: string;
  created_at?: string;
}

export interface NWTerm {
  term: string;
  sugg_usage: number;
  importance?: number;
  in_title?: boolean;
  in_h1?: boolean;
}

export interface NWMetrics {
  words_min?: number;
  words_max?: number;
  words_avg?: number;
  headings_avg?: number;
  paragraphs_avg?: number;
  images_avg?: number;
}

export interface NWCompetitor {
  url: string;
  title?: string;
  position?: number;
  words?: number;
  score?: number;
}

export interface NWGuidelines {
  terms: NWTerm[];
  terms_txt?: string;
  metrics?: NWMetrics;
  ideas?: string[];
  questions?: string[];
  competitors?: NWCompetitor[];
  status?: string;
}

export async function listNWProjects(apiKey?: string): Promise<NWProject[]> {
  const { data, error } = await supabase.functions.invoke("neuronwriter-api", {
    body: { action: "list-projects", apiKey },
  });

  if (error) {
    console.error("Edge function error:", error);
    throw new Error(`Edge Function error: ${error.message}`);
  }

  if (data.error) {
    console.error("NeuronWriter API error:", data);
    const errorMsg = data.message || data.error;
    const details = data.details ? ` - ${JSON.stringify(data.details)}` : '';
    throw new Error(`NeuronWriter API error: ${errorMsg}${details}`);
  }

  return data.projects || data || [];
}

export async function listNWQueries(projectId: string, status?: string, apiKey?: string): Promise<NWQuery[]> {
  const { data, error } = await supabase.functions.invoke("neuronwriter-api", {
    body: { action: "list-queries", projectId, status, apiKey },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);

  return data.queries || data || [];
}

// Map language codes to NeuronWriter API format
const LANGUAGE_MAP: Record<string, string> = {
  de: "German",
  en: "English",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pl: "Polish",
};

export async function startNewQuery(
  projectId: string,
  keyword: string,
  language: string,
  engine: string,
  apiKey?: string
): Promise<{ queryId: string; status: string }> {
  // Map language code to full name if needed
  const mappedLanguage = LANGUAGE_MAP[language] || language;

  console.log("Starting new query:", { projectId, keyword, language: mappedLanguage, engine });

  const { data, error } = await supabase.functions.invoke("neuronwriter-api", {
    body: {
      action: "new-query",
      projectId,
      keyword,
      language: mappedLanguage,
      engine,
      apiKey
    },
  });

  if (error) {
    console.error("Edge function error:", error);
    throw new Error(`Edge Function error: ${error.message}`);
  }

  if (data.error) {
    console.error("NeuronWriter API error:", data);
    const errorMsg = data.message || data.error;
    const details = data.details ? ` - ${JSON.stringify(data.details)}` : '';
    throw new Error(`NeuronWriter API error: ${errorMsg}${details}`);
  }

  return { queryId: data.query || data.id, status: data.status || "pending" };
}

export async function getQueryGuidelines(queryId: string, apiKey?: string): Promise<NWGuidelines> {
  const { data, error } = await supabase.functions.invoke("neuronwriter-api", {
    body: { action: "get-query", queryId, apiKey },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);

  const guidelines = transformNWGuidelines(data);

  console.log("Processed NeuronWriter data:", {
    totalTermsCount: guidelines.terms.length,
    questionsCount: guidelines.questions?.length || 0,
    competitorsCount: guidelines.competitors?.length || 0,
    metrics: guidelines.metrics
  });

  return guidelines;
}

/**
 * Transforms raw NeuronWriter API response to our NWGuidelines format.
 * This handles both:
 * 1. Fresh API responses (from getQueryGuidelines)
 * 2. Old stored data in database (raw API structure)
 */
export function transformNWGuidelines(data: any): NWGuidelines {
  // If data is already transformed (terms is an array), return as-is
  if (Array.isArray(data?.terms)) {
    return data as NWGuidelines;
  }

  // Transform raw API response (terms is an object)
  const basicTerms = data.terms?.content_basic?.map((term: any) => ({
    term: term.t,
    sugg_usage: Array.isArray(term.sugg_usage) ? term.sugg_usage[1] : term.sugg_usage,
    usage_pc: term.usage_pc,
    in_title: data.terms?.title?.some((t: any) => t.t === term.t),
    in_h1: data.terms?.h1?.some((t: any) => t.t === term.t),
  })) || [];

  const extendedTerms = data.terms?.content_extended?.map((term: any) => ({
    term: term.t,
    sugg_usage: Array.isArray(term.sugg_usage) ? term.sugg_usage[1] : term.sugg_usage,
    usage_pc: term.usage_pc,
    in_title: data.terms?.title?.some((t: any) => t.t === term.t),
    in_h1: data.terms?.h1?.some((t: any) => t.t === term.t),
  })) || [];

  const allTerms = [...basicTerms, ...extendedTerms];

  const allQuestions = [
    ...(data.ideas?.suggest_questions?.map((q: any) => q.q) || []),
    ...(data.ideas?.people_also_ask?.map((q: any) => q.q) || []),
    ...(data.ideas?.content_questions?.map((q: any) => q.q) || []),
  ];

  const metrics = data.metrics ? {
    words_min: data.metrics.word_count?.target ? Math.round(data.metrics.word_count.target * 0.9) : undefined,
    words_max: data.metrics.word_count?.target ? Math.round(data.metrics.word_count.target * 1.1) : undefined,
    words_avg: data.metrics.word_count?.target,
    readability_avg: data.metrics.readability?.target,
  } : undefined;

  return {
    terms: allTerms,
    terms_txt: data.terms_txt,
    metrics,
    ideas: [],
    questions: allQuestions,
    competitors: data.competitors || [],
    status: data.status,
  };
}

export async function evaluateContent(queryId: string, content: string, apiKey?: string): Promise<{ score: number; details: unknown }> {
  const { data, error } = await supabase.functions.invoke("neuronwriter-api", {
    body: { action: "evaluate-content", queryId, content, apiKey },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);

  return { score: data.score || 0, details: data };
}

// Poll for query completion (after new-query, it takes ~60s)
export async function pollQueryUntilReady(
  queryId: string,
  maxAttempts = 20,
  intervalMs = 5000,
  apiKey?: string
): Promise<NWGuidelines> {
  for (let i = 0; i < maxAttempts; i++) {
    const guidelines = await getQueryGuidelines(queryId, apiKey);

    if (guidelines.status === "ready" || (guidelines.terms && guidelines.terms.length > 0)) {
      return guidelines;
    }

    if (guidelines.status === "error") {
      throw new Error("Query analysis failed");
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error("Query analysis timed out");
}
