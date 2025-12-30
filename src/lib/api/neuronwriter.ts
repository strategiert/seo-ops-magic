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

export async function listNWProjects(): Promise<NWProject[]> {
  const { data, error } = await supabase.functions.invoke("neuronwriter-api", {
    body: { action: "list-projects" },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  
  return data.projects || data || [];
}

export async function listNWQueries(projectId: string, status?: string): Promise<NWQuery[]> {
  const { data, error } = await supabase.functions.invoke("neuronwriter-api", {
    body: { action: "list-queries", projectId, status },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  
  return data.queries || data || [];
}

export async function startNewQuery(
  projectId: string, 
  keyword: string, 
  lang?: string, 
  country?: string
): Promise<{ queryId: string; status: string }> {
  const { data, error } = await supabase.functions.invoke("neuronwriter-api", {
    body: { action: "new-query", projectId, keyword, lang, country },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  
  return { queryId: data.query || data.id, status: data.status || "pending" };
}

export async function getQueryGuidelines(queryId: string): Promise<NWGuidelines> {
  const { data, error } = await supabase.functions.invoke("neuronwriter-api", {
    body: { action: "get-query", queryId },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  
  return {
    terms: data.terms || [],
    terms_txt: data.terms_txt,
    metrics: data.metrics,
    ideas: data.ideas || [],
    questions: data.questions || [],
    competitors: data.competitors || [],
    status: data.status,
  };
}

export async function evaluateContent(queryId: string, content: string): Promise<{ score: number; details: unknown }> {
  const { data, error } = await supabase.functions.invoke("neuronwriter-api", {
    body: { action: "evaluate-content", queryId, content },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  
  return { score: data.score || 0, details: data };
}

// Poll for query completion (after new-query, it takes ~60s)
export async function pollQueryUntilReady(
  queryId: string, 
  maxAttempts = 20, 
  intervalMs = 5000
): Promise<NWGuidelines> {
  for (let i = 0; i < maxAttempts; i++) {
    const guidelines = await getQueryGuidelines(queryId);
    
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
