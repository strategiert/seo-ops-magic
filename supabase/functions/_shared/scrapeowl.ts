import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ScrapeResult {
    url: string;
    markdown: string;
    error?: string;
}

const SCRAPEOWL_API_KEY = Deno.env.get("SCRAPEOWL_API_KEY");

export async function scrapeUrl(url: string, supabase?: SupabaseClient): Promise<ScrapeResult> {
    // 1. Check Cache
    if (supabase) {
        try {
            const { data: cached } = await supabase
                .from("research_cache")
                .select("data")
                .eq("key", url)
                .eq("type", "url_scrape")
                .gt("expires_at", new Date().toISOString())
                .single();

            if (cached) {
                console.log(`[ScrapeOwl] Cache hit for ${url}`);
                return cached.data as ScrapeResult;
            }
        } catch (err) {
            console.warn(`[ScrapeOwl] Cache check failed for ${url}`, err);
        }
    }

    const apiKey = SCRAPEOWL_API_KEY;

    if (!apiKey) {
        console.error("SCRAPEOWL_API_KEY is not set");
        return { url, markdown: "", error: "Configuration missing" };
    }

    // Basic markdown extraction
    const apiUrl = `https://api.scrapeowl.com/v1/scrape`;

    const payload = {
        api_key: apiKey,
        url: url,
        elements: [
            {
                type: "extract",
                selector: "body",
                format: "markdown"
            }
        ],
        render_js: true
    };

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const txt = await response.text();
            console.error(`ScrapeOwl error for ${url}: ${response.status} - ${txt}`);
            return { url, markdown: "", error: `API Error ${response.status}` };
        }

        const data = await response.json();
        const textContent = data.data?.[0]?.results?.[0]?.text || "";

        const result = { url, markdown: textContent, error: undefined };

        // 2. Save to Cache
        if (supabase && !result.error && result.markdown.length > 50) {
            try {
                await supabase.from("research_cache").upsert({
                    key: url,
                    type: "url_scrape",
                    data: result,
                    updated_at: new Date().toISOString(), // Optional if table has trigger, but we set explicit
                    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
                }, { onConflict: "key, type" });
            } catch (cacheErr) {
                console.warn(`[ScrapeOwl] Failed to save cache for ${url}`, cacheErr);
            }
        }

        return result;

    } catch (err) {
        console.error(`ScrapeOwl exception for ${url}:`, err);
        return { url, markdown: "", error: err instanceof Error ? err.message : String(err) };
    }
}

/**
 * Clean helper to scrape multiple URLs in parallel
 */
export async function scrapeUrls(urls: string[], supabase?: SupabaseClient): Promise<ScrapeResult[]> {
    if (!urls.length) return [];

    // Limit concurrency to avoid rate limits
    const results = await Promise.all(urls.map(u => scrapeUrl(u, supabase)));
    return results;
}
