// supabase/functions/_shared/perplexity-client.ts
// Perplexity Client - Research suite for market analysis, brand perception, etc.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  ResearchType,
  BrandContext,
  ResearchResult,
  MarketAnalysisResult,
  IndustryTrendsResult,
  BrandPerceptionResult,
  AudienceInsightsResult,
  ContentGapsResult,
  PricingIntelligenceResult,
  Citation,
} from "./brand-research-types.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

interface PerplexityConfig {
  model: "llama-3.1-sonar-large-128k-online" | "llama-3.1-sonar-small-128k-online";
  temperature: number;
  maxTokens: number;
}

const MODEL_CONFIG: Record<"detailed" | "basic", PerplexityConfig> = {
  detailed: {
    model: "llama-3.1-sonar-large-128k-online",
    temperature: 0.2,
    maxTokens: 4000,
  },
  basic: {
    model: "llama-3.1-sonar-small-128k-online",
    temperature: 0.3,
    maxTokens: 2000,
  },
};

// Research types that need detailed model
const DETAILED_RESEARCH_TYPES: ResearchType[] = [
  "market_analysis",
  "brand_perception",
  "audience_insights",
];

// Cache duration in days per research type
const CACHE_DURATION: Record<ResearchType, number> = {
  market_analysis: 14,
  industry_trends: 7,
  brand_perception: 7,
  audience_insights: 14,
  content_gaps: 7,
  pricing_intelligence: 3,
  technology_stack: 30,
};

// ============================================================================
// RESEARCH PROMPTS
// ============================================================================

function getResearchPrompt(type: ResearchType, context: BrandContext): string {
  const { brandName, domain, industry, products, services, keywords, competitors } = context;
  const locale = context.locale || "de-DE";
  const lang = locale.startsWith("de") ? "German" : "English";

  switch (type) {
    case "market_analysis":
      return `Analyze the market for "${brandName}" (${domain}).
Industry: ${industry || "unknown"}
Products/Services: ${[...products, ...services].join(", ") || "various"}

Provide a comprehensive market analysis in ${lang}:
1. Market size and growth rate
2. Key market segments
3. Major players and market share
4. Entry barriers
5. Growth opportunities
6. Potential threats
7. Current market trends

Format your response as JSON:
{
  "marketSize": "estimated market size",
  "growthRate": "annual growth rate",
  "marketSegments": ["segment1", "segment2"],
  "keyPlayers": ["player1", "player2"],
  "entryBarriers": ["barrier1", "barrier2"],
  "opportunities": ["opportunity1", "opportunity2"],
  "threats": ["threat1", "threat2"],
  "trends": ["trend1", "trend2"]
}`;

    case "industry_trends":
      return `Research current and emerging trends in the ${industry || "business"} industry.
Focus: ${brandName} (${domain})
Keywords: ${keywords.slice(0, 10).join(", ")}

Provide ${lang} analysis of:
1. Current industry trends (with impact level)
2. Emerging technologies
3. Regulatory changes
4. Consumer behavior shifts
5. 6-12 month outlook

Format as JSON:
{
  "currentTrends": [{"name": "trend", "description": "...", "impact": "high/medium/low"}],
  "emergingTechnologies": ["tech1", "tech2"],
  "regulatoryChanges": ["change1", "change2"],
  "consumerBehaviorShifts": ["shift1", "shift2"],
  "futureOutlook": "summary of what to expect",
  "timeframe": "6-12 months"
}`;

    case "brand_perception":
      return `Research the external perception of "${brandName}" (${domain}).

Analyze in ${lang}:
1. Overall sentiment (positive/neutral/negative/mixed)
2. Online reviews summary (platforms, ratings, common themes)
3. Media mentions and press coverage
4. Social media presence and engagement
5. Reputation indicators

Format as JSON:
{
  "overallSentiment": "positive/neutral/negative/mixed",
  "sentimentScore": -100 to 100,
  "reviewSummary": {
    "platforms": ["Google", "Trustpilot"],
    "averageRating": 4.2,
    "totalReviews": 150,
    "commonPraises": ["praise1", "praise2"],
    "commonComplaints": ["complaint1", "complaint2"]
  },
  "mediaMentions": [{"source": "name", "sentiment": "positive/neutral/negative", "summary": "..."}],
  "socialPresence": {
    "platforms": ["LinkedIn", "Instagram"],
    "engagementLevel": "high/medium/low",
    "audienceSize": "approximate size"
  },
  "reputationIndicators": ["indicator1", "indicator2"]
}`;

    case "audience_insights":
      return `Research the target audience for "${brandName}" (${domain}).
Industry: ${industry || "unknown"}
Products/Services: ${[...products, ...services].join(", ")}

Provide ${lang} audience analysis:
1. Primary demographics (age, gender, location, income, education)
2. Psychographics (interests, values, lifestyle)
3. Buying behavior (decision factors, frequency, price sensitivity, channels)
4. Pain points
5. Goals
6. Content preferences (formats, topics, platforms)

Format as JSON:
{
  "primaryDemographics": {
    "ageRange": "25-45",
    "gender": "mixed/male/female",
    "location": ["Germany", "Austria"],
    "income": "middle to high",
    "education": "higher education"
  },
  "psychographics": {
    "interests": ["interest1", "interest2"],
    "values": ["value1", "value2"],
    "lifestyle": ["lifestyle1", "lifestyle2"]
  },
  "buyingBehavior": {
    "decisionFactors": ["quality", "price"],
    "purchaseFrequency": "monthly/quarterly/yearly",
    "priceSenitivity": "low/medium/high",
    "preferredChannels": ["online", "retail"]
  },
  "painPoints": ["pain1", "pain2"],
  "goals": ["goal1", "goal2"],
  "contentPreferences": {
    "formats": ["video", "blog"],
    "topics": ["topic1", "topic2"],
    "platforms": ["LinkedIn", "YouTube"]
  }
}`;

    case "content_gaps":
      return `Analyze content gaps for "${brandName}" (${domain}) compared to competitors.
Industry: ${industry || "unknown"}
Current Keywords: ${keywords.slice(0, 15).join(", ")}
${competitors?.length ? `Competitors: ${competitors.join(", ")}` : ""}

Find in ${lang}:
1. Topics competitors cover that ${brandName} might be missing
2. High-opportunity keywords not being targeted
3. Content format gaps
4. Competitor content strengths
5. Recommendations

Format as JSON:
{
  "missingTopics": [{"topic": "...", "searchVolume": "high/medium/low", "competitorsCovering": ["comp1"], "opportunity": "high/medium/low"}],
  "underservedKeywords": [{"keyword": "...", "difficulty": "easy/medium/hard", "opportunity": "..."}],
  "contentFormatGaps": ["video content", "podcasts"],
  "competitorAdvantages": [{"competitor": "name", "contentStrength": "..."}],
  "recommendations": ["rec1", "rec2"]
}`;

    case "pricing_intelligence":
      return `Research pricing in the ${industry || "market"} for products/services like:
${[...products, ...services].slice(0, 10).join(", ")}
${competitors?.length ? `Compare with: ${competitors.join(", ")}` : ""}

Provide ${lang} pricing analysis:
1. Competitor pricing (products and prices)
2. Price ranges (low, mid, high, premium)
3. Common pricing models
4. Value propositions
5. Pricing recommendations

Format as JSON:
{
  "competitorPricing": [{"competitor": "name", "products": [{"name": "...", "price": "...", "priceModel": "subscription/one-time"}]}],
  "priceRanges": {
    "low": "€0-50",
    "mid": "€50-200",
    "high": "€200-500",
    "premium": "€500+"
  },
  "pricingModels": ["subscription", "per-seat", "usage-based"],
  "valuePropositions": [{"competitor": "name", "value": "..."}],
  "recommendations": ["rec1", "rec2"]
}`;

    case "technology_stack":
      return `Research the technology stack commonly used in ${industry || "the industry"}.
Focus: ${domain}

Identify:
1. Technologies detected on the website
2. Technologies used by competitors
3. Industry standard technologies
4. Recommendations

Format as JSON:
{
  "detectedTechnologies": [{"category": "CMS", "technology": "WordPress", "confidence": "high/medium/low"}],
  "competitorTech": [{"competitor": "name", "technologies": ["tech1", "tech2"]}],
  "industryStandards": ["standard1", "standard2"],
  "recommendations": ["rec1", "rec2"]
}`;

    default:
      throw new Error(`Unknown research type: ${type}`);
  }
}

// ============================================================================
// PERPLEXITY API CALL
// ============================================================================

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  citations?: string[];
}

async function callPerplexity(
  prompt: string,
  config: PerplexityConfig
): Promise<{ content: string; citations: string[] }> {
  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY not configured");
  }

  console.log(`[PerplexityClient] Calling API with model: ${config.model}`);

  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: "You are a market research analyst. Provide accurate, data-driven insights. Always respond with valid JSON when requested. Include sources when available.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[PerplexityClient] API Error:", error);
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data: PerplexityResponse = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const citations = data.citations || [];

  return { content, citations };
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

function parseResearchResponse(content: string, citations: string[]): ResearchResult {
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Add citations if not already present
  if (!parsed.citations && citations.length > 0) {
    parsed.citations = citations.map((url, i) => ({
      url,
      title: `Source ${i + 1}`,
    }));
  }

  return parsed;
}

// ============================================================================
// MAIN RESEARCH FUNCTION
// ============================================================================

export interface ExecuteResearchOptions {
  forceRefresh?: boolean;
  depth?: "basic" | "detailed";
}

export async function executeResearch(
  type: ResearchType,
  context: BrandContext,
  supabase?: SupabaseClient,
  options: ExecuteResearchOptions = {}
): Promise<{
  result: ResearchResult;
  cached: boolean;
  citations: Citation[];
}> {
  const { forceRefresh = false, depth } = options;

  // Determine model based on research type or explicit depth
  const useDetailed = depth === "detailed" || DETAILED_RESEARCH_TYPES.includes(type);
  const config = MODEL_CONFIG[useDetailed ? "detailed" : "basic"];

  // Generate cache key
  const cacheKey = generateCacheKey(type, context);

  // Check cache (if supabase client provided and not forcing refresh)
  if (supabase && !forceRefresh) {
    const cached = await getCachedResult(supabase, context.brandName, type, cacheKey);
    if (cached) {
      console.log(`[PerplexityClient] Cache hit for ${type}`);
      return {
        result: cached.result,
        cached: true,
        citations: cached.citations || [],
      };
    }
  }

  // Execute research
  console.log(`[PerplexityClient] Executing ${type} research for ${context.brandName}`);
  const prompt = getResearchPrompt(type, context);
  const { content, citations } = await callPerplexity(prompt, config);

  // Parse response
  const result = parseResearchResponse(content, citations);

  // Cache result
  if (supabase) {
    await cacheResult(supabase, context.brandName, type, cacheKey, result, citations);
  }

  return {
    result,
    cached: false,
    citations: citations.map((url, i) => ({ url, title: `Source ${i + 1}` })),
  };
}

// ============================================================================
// BATCH RESEARCH
// ============================================================================

export async function executeMultipleResearch(
  types: ResearchType[],
  context: BrandContext,
  supabase?: SupabaseClient,
  options: ExecuteResearchOptions = {}
): Promise<{
  results: Partial<Record<ResearchType, ResearchResult>>;
  cached: ResearchType[];
  fresh: ResearchType[];
  errors: Array<{ type: ResearchType; error: string }>;
}> {
  const results: Partial<Record<ResearchType, ResearchResult>> = {};
  const cached: ResearchType[] = [];
  const fresh: ResearchType[] = [];
  const errors: Array<{ type: ResearchType; error: string }> = [];

  // Execute in parallel (with concurrency limit)
  const concurrencyLimit = 3;
  const chunks = chunkArray(types, concurrencyLimit);

  for (const chunk of chunks) {
    const promises = chunk.map(async (type) => {
      try {
        const { result, cached: wasCached } = await executeResearch(
          type,
          context,
          supabase,
          options
        );
        results[type] = result;
        if (wasCached) {
          cached.push(type);
        } else {
          fresh.push(type);
        }
      } catch (error) {
        console.error(`[PerplexityClient] Error for ${type}:`, error);
        errors.push({
          type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.all(promises);
  }

  return { results, cached, fresh, errors };
}

// ============================================================================
// CACHING
// ============================================================================

function generateCacheKey(type: ResearchType, context: BrandContext): string {
  const keyParts = [
    context.brandName.toLowerCase().replace(/\s+/g, "_"),
    context.domain.replace(/[^a-z0-9]/gi, "_"),
    type,
  ];
  return keyParts.join(":");
}

async function getCachedResult(
  supabase: SupabaseClient,
  brandProfileId: string,
  type: ResearchType,
  cacheKey: string
): Promise<{ result: ResearchResult; citations: Citation[] } | null> {
  const { data, error } = await supabase
    .from("brand_research_results")
    .select("result_data, citations, expires_at")
    .eq("cache_key", cacheKey)
    .eq("research_type", type)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    result: data.result_data as ResearchResult,
    citations: data.citations as Citation[] || [],
  };
}

async function cacheResult(
  supabase: SupabaseClient,
  brandProfileId: string,
  type: ResearchType,
  cacheKey: string,
  result: ResearchResult,
  citations: string[]
): Promise<void> {
  const cacheDays = CACHE_DURATION[type] || 7;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + cacheDays);

  // Get brand profile ID from context (we need to look it up)
  const { data: profile } = await supabase
    .from("brand_profiles")
    .select("id")
    .eq("brand_name", brandProfileId)
    .single();

  if (!profile) {
    console.warn("[PerplexityClient] Could not find brand profile for caching");
    return;
  }

  await supabase.from("brand_research_results").upsert(
    {
      brand_profile_id: profile.id,
      research_type: type,
      cache_key: cacheKey,
      result_data: result,
      citations: citations.map((url, i) => ({ url, title: `Source ${i + 1}` })),
      expires_at: expiresAt.toISOString(),
      model_used: DETAILED_RESEARCH_TYPES.includes(type)
        ? "llama-3.1-sonar-large-128k-online"
        : "llama-3.1-sonar-small-128k-online",
    },
    {
      onConflict: "brand_profile_id,research_type,cache_key",
    }
  );

  console.log(`[PerplexityClient] Cached ${type} result (expires in ${cacheDays} days)`);
}

// ============================================================================
// HELPERS
// ============================================================================

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  getResearchPrompt,
  parseResearchResponse,
  MODEL_CONFIG,
  CACHE_DURATION,
};
