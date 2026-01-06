import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
// const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN");
// const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD");

export interface KeywordData {
    volume?: number;
    cpc?: number;
    competition?: number;
    serp?: {
        topResults: { title: string; link: string; snippet: string }[];
        relatedSearches: string[];
        peopleAlsoAsk: string[];
    };
}

export async function enrichKeyword(keyword: string, supabase?: SupabaseClient): Promise<KeywordData> {
    // 1. Check Cache
    if (supabase) {
        try {
            const { data: cached } = await supabase
                .from("research_cache")
                .select("data")
                .eq("key", keyword)
                .eq("type", "keyword_serp")
                .gt("expires_at", new Date().toISOString())
                .single();

            if (cached) {
                console.log(`[KeywordResearch] Cache hit for ${keyword}`);
                return cached.data as KeywordData;
            }
        } catch (err) {
            console.warn(`[KeywordResearch] Cache check failed for ${keyword}`, err);
        }
    }

    const data: KeywordData = {};

    // 2. Serper.dev (Fast, Cheap SERP data)
    if (SERPER_API_KEY) {
        try {
            const response = await fetch("https://google.serper.dev/search", {
                method: "POST",
                headers: {
                    "X-API-KEY": SERPER_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    q: keyword,
                    gl: "de", // Germany
                    hl: "de", // German
                    num: 10
                }),
            });

            if (response.ok) {
                // deno-lint-ignore no-explicit-any
                const json = await response.json() as any;

                // Extract Organic
                data.serp = {
                    topResults: json.organic?.slice(0, 5).map((r: any) => ({
                        title: r.title,
                        link: r.link,
                        snippet: r.snippet
                    })) || [],
                    relatedSearches: json.relatedSearches?.map((r: any) => r.query) || [],
                    peopleAlsoAsk: json.peopleAlsoAsk?.map((r: any) => r.question) || []
                };
            } else {
                console.error("Serper API error:", await response.text());
            }
        } catch (e) {
            console.error("Serper exception:", e);
        }
    }

    // 3. Save to Cache
    if (supabase && data.serp) {
        try {
            await supabase.from("research_cache").upsert({
                key: keyword,
                type: "keyword_serp",
                data: data,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days for SERP
            }, { onConflict: "key, type" });
        } catch (cacheErr) {
            console.warn(`[KeywordResearch] Failed to save cache for ${keyword}`, cacheErr);
        }
    }

    return data;
}
