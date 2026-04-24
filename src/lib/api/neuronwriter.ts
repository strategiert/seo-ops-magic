import { convex } from "@/providers/ConvexClientProvider";
import { api } from "../../../convex/_generated/api";

/**
 * NeuronWriter API Client.
 *
 * Uses the shared ConvexReactClient from ConvexClientProvider, which is
 * wrapped by ConvexProviderWithClerk and therefore carries the user's
 * Clerk token on every request. A previous implementation created a
 * *separate* ConvexHttpClient here without auth, which caused every
 * NeuronWriter call to fail with "Unauthorized" inside the Convex
 * action (requireAuth).
 */

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

export async function listNWProjects(apiKey: string): Promise<NWProject[]> {
  const data = await convex.action(api.actions.neuronwriter.listProjects, { apiKey });
  // NW response shape: either `{ projects: [...] }` or a bare array.
  // Each entry looks like `{ project: "<hash>", name, language, engine }` —
  // the hash field is `project`, not `id`. Normalize it here so UI code
  // can use `.id` consistently.
  const raw: any[] = Array.isArray(data) ? data : data.projects || [];
  return raw
    .map((p: any) => ({
      id: String(p.project ?? p.id ?? p.hash ?? p.project_id ?? "").trim(),
      name: p.name || "(kein Name)",
      lang: p.language,
      country: p.engine,
    }))
    // Radix Select rejects empty-string values; drop any entry that
    // doesn't have a usable ID so the dropdown stays selectable.
    .filter((p) => p.id.length > 0);
}

export async function listNWQueries(projectId: string, status?: string, apiKey?: string): Promise<NWQuery[]> {
  if (!apiKey) throw new Error("API Key erforderlich");
  const data = await convex.action(api.actions.neuronwriter.listQueries, {
    apiKey,
    projectId,
    status,
  });
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
  apiKey: string
): Promise<{ queryId: string; status: string }> {
  const mappedLanguage = LANGUAGE_MAP[language] || language;
  console.log("Starting new query:", { projectId, keyword, language: mappedLanguage, engine });

  const data = await convex.action(api.actions.neuronwriter.newQuery, {
    apiKey,
    projectId,
    keyword,
    language: mappedLanguage,
    engine,
  });

  return { queryId: data.query || data.id, status: data.status || "pending" };
}

export async function getQueryGuidelines(queryId: string, apiKey: string): Promise<NWGuidelines> {
  const data = await convex.action(api.actions.neuronwriter.getQuery, {
    apiKey,
    queryId,
  });

  const guidelines = transformNWGuidelines(data);

  console.log("Processed NeuronWriter data:", {
    totalTermsCount: guidelines.terms.length,
    questionsCount: guidelines.questions?.length || 0,
    competitorsCount: guidelines.competitors?.length || 0,
    metrics: guidelines.metrics,
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
  const basicTerms =
    data.terms?.content_basic?.map((term: any) => ({
      term: term.t,
      sugg_usage: Array.isArray(term.sugg_usage) ? term.sugg_usage[1] : term.sugg_usage,
      usage_pc: term.usage_pc,
      in_title: data.terms?.title?.some((t: any) => t.t === term.t),
      in_h1: data.terms?.h1?.some((t: any) => t.t === term.t),
    })) || [];

  const extendedTerms =
    data.terms?.content_extended?.map((term: any) => ({
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

  const metrics = data.metrics
    ? {
        words_min: data.metrics.word_count?.target ? Math.round(data.metrics.word_count.target * 0.9) : undefined,
        words_max: data.metrics.word_count?.target ? Math.round(data.metrics.word_count.target * 1.1) : undefined,
        words_avg: data.metrics.word_count?.target,
        readability_avg: data.metrics.readability?.target,
      }
    : undefined;

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

export async function evaluateContent(
  queryId: string,
  content: string,
  apiKey: string
): Promise<{ score: number; details: unknown }> {
  const data = await convex.action(api.actions.neuronwriter.evaluateContent, {
    apiKey,
    queryId,
    html: content,
  });

  return { score: data.score || data.content_score || 0, details: data };
}

// Poll for query completion (after new-query, it takes ~60s)
export async function pollQueryUntilReady(
  queryId: string,
  apiKey: string,
  maxAttempts = 20,
  intervalMs = 5000
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
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Query analysis timed out");
}
