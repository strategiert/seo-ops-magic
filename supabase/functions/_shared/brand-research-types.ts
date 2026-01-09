// supabase/functions/_shared/brand-research-types.ts
// Type definitions for Brand Intelligence System

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const RESEARCH_TYPES = [
  'market_analysis',
  'industry_trends',
  'brand_perception',
  'audience_insights',
  'content_gaps',
  'pricing_intelligence',
  'technology_stack',
] as const;

export type ResearchType = typeof RESEARCH_TYPES[number];

export const JOB_TYPES = [
  'full_discovery',
  'sitemap_crawl',
  'perplexity_research',
  'competitor_analysis',
  'competitor_crawl',
] as const;

export type JobType = typeof JOB_TYPES[number];

export const JOB_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;
export type JobStatus = typeof JOB_STATUSES[number];

export const CRAWL_STATUSES = ['pending', 'crawling', 'completed', 'failed', 'skipped'] as const;
export type CrawlStatus = typeof CRAWL_STATUSES[number];

export const THREAT_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type ThreatLevel = typeof THREAT_LEVELS[number];

// ============================================================================
// BRAND CONTEXT (Input for Research)
// ============================================================================

export interface BrandContext {
  brandName: string;
  domain: string;
  industry?: string;
  tagline?: string;
  description?: string;
  products: string[];
  services: string[];
  keywords: string[];
  competitors?: string[];
  targetAudience?: string[];
  locale?: string;
}

// ============================================================================
// RESEARCH JOB
// ============================================================================

export interface ResearchJob {
  id: string;
  brand_profile_id: string;
  job_type: JobType;
  config: JobConfig;
  status: JobStatus;
  progress: number;
  current_step?: string;
  steps_completed: number;
  steps_total: number;
  result?: unknown;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface JobConfig {
  websiteUrl?: string;
  maxPages?: number;
  researchTypes?: ResearchType[];
  priorityPaths?: string[];
  excludePaths?: string[];
  competitorId?: string;
  forceRefresh?: boolean;
}

// ============================================================================
// PERPLEXITY RESEARCH RESULTS
// ============================================================================

export interface Citation {
  url: string;
  title: string;
  snippet?: string;
}

export interface MarketAnalysisResult {
  marketSize: string;
  growthRate: string;
  marketSegments: string[];
  keyPlayers: string[];
  entryBarriers: string[];
  opportunities: string[];
  threats: string[];
  trends: string[];
  citations: Citation[];
}

export interface IndustryTrendsResult {
  currentTrends: Array<{
    name: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
  }>;
  emergingTechnologies: string[];
  regulatoryChanges: string[];
  consumerBehaviorShifts: string[];
  futureOutlook: string;
  timeframe: string;
  citations: Citation[];
}

export interface BrandPerceptionResult {
  overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScore: number; // -100 to 100
  reviewSummary: {
    platforms: string[];
    averageRating?: number;
    totalReviews?: number;
    commonPraises: string[];
    commonComplaints: string[];
  };
  mediaMentions: Array<{
    source: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    summary: string;
  }>;
  socialPresence: {
    platforms: string[];
    engagementLevel: 'low' | 'medium' | 'high';
    audienceSize?: string;
  };
  reputationIndicators: string[];
  citations: Citation[];
}

export interface AudienceInsightsResult {
  primaryDemographics: {
    ageRange: string;
    gender: string;
    location: string[];
    income: string;
    education: string;
  };
  psychographics: {
    interests: string[];
    values: string[];
    lifestyle: string[];
  };
  buyingBehavior: {
    decisionFactors: string[];
    purchaseFrequency: string;
    priceSenitivity: 'low' | 'medium' | 'high';
    preferredChannels: string[];
  };
  painPoints: string[];
  goals: string[];
  contentPreferences: {
    formats: string[];
    topics: string[];
    platforms: string[];
  };
  citations: Citation[];
}

export interface ContentGapsResult {
  missingTopics: Array<{
    topic: string;
    searchVolume?: string;
    competitorsCovering: string[];
    opportunity: 'low' | 'medium' | 'high';
  }>;
  underservedKeywords: Array<{
    keyword: string;
    difficulty?: string;
    opportunity: string;
  }>;
  contentFormatGaps: string[];
  competitorAdvantages: Array<{
    competitor: string;
    contentStrength: string;
  }>;
  recommendations: string[];
  citations: Citation[];
}

export interface PricingIntelligenceResult {
  competitorPricing: Array<{
    competitor: string;
    products: Array<{
      name: string;
      price: string;
      priceModel: string;
    }>;
  }>;
  priceRanges: {
    low: string;
    mid: string;
    high: string;
    premium: string;
  };
  pricingModels: string[];
  valuePropositions: Array<{
    competitor: string;
    value: string;
  }>;
  recommendations: string[];
  citations: Citation[];
}

export interface TechnologyStackResult {
  detectedTechnologies: Array<{
    category: string;
    technology: string;
    confidence: 'low' | 'medium' | 'high';
  }>;
  competitorTech: Array<{
    competitor: string;
    technologies: string[];
  }>;
  industryStandards: string[];
  recommendations: string[];
  citations: Citation[];
}

export type ResearchResult =
  | MarketAnalysisResult
  | IndustryTrendsResult
  | BrandPerceptionResult
  | AudienceInsightsResult
  | ContentGapsResult
  | PricingIntelligenceResult
  | TechnologyStackResult;

// ============================================================================
// COMPETITOR PROFILES
// ============================================================================

export interface CompetitorProfile {
  id: string;
  brand_profile_id: string;
  name: string;
  domain: string;
  description?: string;
  industry?: string;
  strengths: string[];
  weaknesses: string[];
  market_position?: string;
  unique_selling_points: string[];
  crawl_status: CrawlStatus;
  crawl_job_id?: string;
  pages_crawled: number;
  extracted_tagline?: string;
  extracted_products: ExtractedProduct[];
  extracted_services: ExtractedService[];
  extracted_keywords: string[];
  extracted_voice?: ExtractedVoice;
  content_analysis?: ContentAnalysis;
  similarity_score?: number;
  threat_level?: ThreatLevel;
  last_research_at?: string;
  last_crawl_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ExtractedProduct {
  name: string;
  description?: string;
  price?: string;
  features?: string[];
}

export interface ExtractedService {
  name: string;
  description?: string;
  pricingModel?: string;
}

export interface ExtractedVoice {
  tone: string[];
  personality: string[];
  formality: 'informal' | 'neutral' | 'formal';
}

export interface ContentAnalysis {
  totalPages: number;
  wordCount: number;
  avgWordsPerPage: number;
  contentTypes: Record<string, number>;
  topTopics: string[];
  publishingFrequency?: string;
}

// ============================================================================
// SITEMAP TYPES
// ============================================================================

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  priority?: number;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  pageType?: string;
}

export interface SitemapResult {
  urls: SitemapUrl[];
  nestedSitemaps: string[];
  totalUrls: number;
  errors: string[];
}

export interface RobotsTxtResult {
  sitemaps: string[];
  disallowed: string[];
  allowed: string[];
  crawlDelay?: number;
}

// ============================================================================
// CRAWL TYPES
// ============================================================================

export interface CrawlConfig {
  maxPages: number;
  priorityPaths: string[];
  excludePaths: string[];
  respectRobotsTxt?: boolean;
  followSitemap?: boolean;
  jsRendering?: boolean;
}

export interface CrawlStrategy {
  primaryUrls: string[];   // High priority (homepage, about, services)
  secondaryUrls: string[]; // Medium priority (products, team)
  tertiaryUrls: string[];  // Low priority (blog, news)
  excludedUrls: string[];  // Filtered out
  totalUrls: number;
}

export interface CrawlResult {
  success: boolean;
  pagesProcessed: number;
  pagesFailed: number;
  usedFallback: boolean;
  fallbackReason?: string;
  errors: string[];
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface BrandDiscoverRequest {
  projectId: string;
  websiteUrl: string;
  options?: {
    parseSitemap?: boolean;
    maxPages?: number;
    runResearch?: boolean;
    researchTypes?: ResearchType[];
    priorityPaths?: string[];
    excludePaths?: string[];
  };
}

export interface BrandDiscoverResponse {
  success: boolean;
  jobId: string;
  message: string;
}

export interface ResearchRequest {
  projectId: string;
  brandProfileId: string;
  researchTypes: ResearchType[];
  forceRefresh?: boolean;
}

export interface ResearchResponse {
  success: boolean;
  results: Partial<Record<ResearchType, ResearchResult>>;
  cached: ResearchType[];
  fresh: ResearchType[];
  errors: Array<{ type: ResearchType; error: string }>;
}

export interface CompetitorDiscoverRequest {
  projectId: string;
  brandProfileId: string;
  options?: {
    maxCompetitors?: number;
    crawlCompetitors?: boolean;
    researchDepth?: 'basic' | 'detailed';
  };
}

export interface CompetitorDiscoverResponse {
  success: boolean;
  competitors: CompetitorProfile[];
  crawlJobIds?: string[];
}

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  progress: number;
  currentStep?: string;
  stepsCompleted: number;
  stepsTotal: number;
  result?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

export function isValidResearchType(type: string): type is ResearchType {
  return RESEARCH_TYPES.includes(type as ResearchType);
}

export function isValidJobType(type: string): type is JobType {
  return JOB_TYPES.includes(type as JobType);
}

export function isValidJobStatus(status: string): status is JobStatus {
  return JOB_STATUSES.includes(status as JobStatus);
}
