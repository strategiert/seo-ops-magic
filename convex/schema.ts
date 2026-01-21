import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex Schema - migrated from Supabase
 *
 * Tables are organized in tiers by dependency:
 * Tier 1: profiles, workspaces (core user data)
 * Tier 2: projects (depends on workspaces)
 * Tier 3: integrations (depends on projects)
 * Tier 4: content_briefs (depends on projects)
 * Tier 5: articles and related (depends on briefs/projects)
 * Tier 6: brand intelligence (depends on projects)
 * Tier 7: utility tables
 */

export default defineSchema({
  // ============ TIER 1: Core User Data ============

  /**
   * User profiles - linked to Clerk user IDs
   * Replaces: profiles table with user_id -> clerkUserId
   */
  profiles: defineTable({
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    fullName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    // Onboarding tracking
    onboardingCompletedAt: v.optional(v.number()), // Unix timestamp when onboarding tour was completed
  })
    .index("by_clerk_user", ["clerkUserId"]),

  /**
   * Workspaces - organizational containers for projects
   * ownerId now references Clerk user ID instead of Supabase auth.uid()
   */
  workspaces: defineTable({
    name: v.string(),
    ownerId: v.string(), // Clerk user ID
  })
    .index("by_owner", ["ownerId"]),

  // ============ TIER 2: Projects ============

  /**
   * Projects - SEO projects within workspaces
   */
  projects: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    domain: v.optional(v.string()),
    wpUrl: v.optional(v.string()),
    defaultCountry: v.optional(v.string()),
    defaultLanguage: v.optional(v.string()),
    defaultTonality: v.optional(v.string()),
    defaultTargetAudience: v.optional(v.string()),
    defaultDesignPreset: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"]),

  // ============ TIER 3: Integrations ============

  /**
   * Integrations - NeuronWriter, WordPress, GSC credentials
   */
  integrations: defineTable({
    projectId: v.id("projects"),
    type: v.string(), // 'neuronwriter' | 'wordpress' | 'gsc'
    isConnected: v.optional(v.boolean()),
    lastSyncAt: v.optional(v.number()), // Unix timestamp
    credentialsEncrypted: v.optional(v.string()),
    // NeuronWriter fields
    nwProjectId: v.optional(v.string()),
    nwProjectName: v.optional(v.string()),
    nwLanguage: v.optional(v.string()),
    nwEngine: v.optional(v.string()),
    // WordPress fields
    wpUsername: v.optional(v.string()),
    wpAppPassword: v.optional(v.string()),
    wpSiteName: v.optional(v.string()),
    wpIsVerified: v.optional(v.boolean()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_type", ["projectId", "type"]),

  // ============ TIER 4: Content Briefs ============

  /**
   * Content briefs - SEO content specifications
   */
  contentBriefs: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    primaryKeyword: v.string(),
    status: v.optional(v.string()), // 'pending' | 'draft' | 'in_progress' | 'completed'
    searchIntent: v.optional(v.string()), // 'informational' | 'transactional' | 'navigational' | 'commercial'
    targetAudience: v.optional(v.string()),
    tonality: v.optional(v.string()),
    targetLength: v.optional(v.number()),
    priorityScore: v.optional(v.number()),
    notes: v.optional(v.string()),
    nwQueryId: v.optional(v.string()),
    nwGuidelines: v.optional(v.any()), // JSONB -> v.any()
    researchPack: v.optional(v.any()), // JSONB with structured research data
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"]),

  // ============ TIER 5: Articles & Related ============

  /**
   * Articles - generated content
   */
  articles: defineTable({
    projectId: v.id("projects"),
    briefId: v.optional(v.id("contentBriefs")),
    title: v.string(),
    primaryKeyword: v.optional(v.string()),
    contentMarkdown: v.optional(v.string()),
    contentHtml: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    outlineJson: v.optional(v.any()),
    faqJson: v.optional(v.any()),
    status: v.optional(v.string()), // 'draft' | 'review' | 'approved' | 'published'
    version: v.optional(v.number()),
    wpPostId: v.optional(v.number()), // WordPress post ID after publishing
  })
    .index("by_project", ["projectId"])
    .index("by_brief", ["briefId"])
    .index("by_project_status", ["projectId", "status"]),

  /**
   * Article design recipes - LLM-generated layout instructions
   */
  articleDesignRecipes: defineTable({
    articleId: v.id("articles"),
    recipeJson: v.any(), // Layout instructions JSON
    recipeVersion: v.string(),
    provider: v.optional(v.string()), // 'gemini' | 'openai' | 'anthropic' | 'fallback'
  })
    .index("by_article", ["articleId"]),

  /**
   * Elementor templates - page builder JSON
   */
  elementorTemplates: defineTable({
    projectId: v.id("projects"),
    articleId: v.optional(v.id("articles")),
    name: v.string(),
    templateJson: v.any(),
    designPreset: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_article", ["articleId"]),

  /**
   * HTML exports - standalone HTML landing pages
   */
  htmlExports: defineTable({
    projectId: v.id("projects"),
    articleId: v.optional(v.id("articles")),
    name: v.string(),
    htmlContent: v.string(),
    designVariant: v.optional(v.string()),
    recipeVersion: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_article", ["articleId"]),

  // ============ TIER 6: Brand Intelligence ============

  /**
   * Brand profiles - comprehensive brand data from crawling and AI analysis
   */
  brandProfiles: defineTable({
    projectId: v.id("projects"),
    // Core brand identity
    brandName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    missionStatement: v.optional(v.string()),
    brandStory: v.optional(v.string()),
    // Complex JSONB fields
    brandVoice: v.optional(v.any()), // { tone, personality_traits, writing_style }
    products: v.optional(v.any()), // Array of product objects
    services: v.optional(v.any()), // Array of service objects
    personas: v.optional(v.any()), // Array of persona objects
    brandKeywords: v.optional(v.any()), // { primary, secondary, long_tail }
    competitors: v.optional(v.any()), // Array of competitor objects
    visualIdentity: v.optional(v.any()),
    internalLinks: v.optional(v.any()),
    currentProjects: v.optional(v.any()),
    // Research results
    marketPosition: v.optional(v.any()),
    industryInsights: v.optional(v.any()),
    externalPerception: v.optional(v.any()),
    audienceInsights: v.optional(v.any()),
    contentGaps: v.optional(v.any()),
    // Crawl tracking
    crawlStatus: v.optional(v.string()), // 'pending' | 'crawling' | 'analyzing' | 'completed' | 'error'
    crawlError: v.optional(v.string()),
    crawlJobId: v.optional(v.string()), // Firecrawl job ID
    lastCrawlAt: v.optional(v.number()),
    lastAnalysisAt: v.optional(v.number()),
    // Vector store
    openaiVectorStoreId: v.optional(v.string()),
    // Research tracking
    researchStatus: v.optional(v.string()), // 'pending' | 'running' | 'completed' | 'failed'
    lastResearchAt: v.optional(v.number()),
    // Crawl config
    sitemapUrls: v.optional(v.any()),
    discoveredUrls: v.optional(v.any()),
    crawlConfig: v.optional(v.any()),
  })
    .index("by_project", ["projectId"])
    .index("by_crawl_job", ["crawlJobId"]),

  /**
   * Brand crawl data - raw crawled page data
   */
  brandCrawlData: defineTable({
    brandProfileId: v.id("brandProfiles"),
    url: v.string(),
    title: v.optional(v.string()),
    contentMarkdown: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    pageType: v.optional(v.string()), // 'homepage' | 'about' | 'product' | 'service' | 'blog' | etc.
    headings: v.optional(v.any()),
    internalLinks: v.optional(v.any()),
    externalLinks: v.optional(v.any()),
    images: v.optional(v.any()),
    relevanceScore: v.optional(v.number()),
    crawledAt: v.number(),
  })
    .index("by_brand_profile", ["brandProfileId"])
    .index("by_relevance", ["brandProfileId", "relevanceScore"]),

  /**
   * Brand vector documents - OpenAI Vector Store tracking
   */
  brandVectorDocuments: defineTable({
    brandProfileId: v.id("brandProfiles"),
    openaiFileId: v.string(),
    documentType: v.string(), // 'brand_core' | 'brand_voice' | 'product' | etc.
    title: v.optional(v.string()),
    contentPreview: v.optional(v.string()),
    tokenCount: v.optional(v.number()),
    sourceUrl: v.optional(v.string()),
    uploadedAt: v.number(),
  })
    .index("by_brand_profile", ["brandProfileId"]),

  /**
   * Brand research jobs - long-running job tracking
   */
  brandResearchJobs: defineTable({
    brandProfileId: v.id("brandProfiles"),
    jobType: v.string(), // 'full_discovery' | 'sitemap_crawl' | 'perplexity_research' | 'competitor_analysis' | 'competitor_crawl'
    config: v.optional(v.any()),
    status: v.string(), // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    progress: v.number(), // 0-100
    currentStep: v.optional(v.string()),
    stepsCompleted: v.number(),
    stepsTotal: v.number(),
    result: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_brand_profile", ["brandProfileId"])
    .index("by_status", ["status"]),

  /**
   * Brand research results - Perplexity research cache
   */
  brandResearchResults: defineTable({
    brandProfileId: v.id("brandProfiles"),
    researchType: v.string(), // 'market_analysis' | 'industry_trends' | 'brand_perception' | etc.
    queryContext: v.optional(v.any()),
    resultData: v.any(),
    citations: v.optional(v.any()),
    cacheKey: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    modelUsed: v.optional(v.string()),
    tokenCount: v.optional(v.number()),
  })
    .index("by_brand_profile_type", ["brandProfileId", "researchType"])
    .index("by_cache_key", ["cacheKey"]),

  /**
   * Brand competitor profiles - detailed competitor analysis
   */
  brandCompetitorProfiles: defineTable({
    brandProfileId: v.id("brandProfiles"),
    name: v.string(),
    domain: v.string(),
    description: v.optional(v.string()),
    industry: v.optional(v.string()),
    strengths: v.optional(v.any()),
    weaknesses: v.optional(v.any()),
    marketPosition: v.optional(v.string()),
    uniqueSellingPoints: v.optional(v.any()),
    crawlStatus: v.optional(v.string()),
    crawlJobId: v.optional(v.string()),
    pagesCrawled: v.optional(v.number()),
    extractedTagline: v.optional(v.string()),
    extractedProducts: v.optional(v.any()),
    extractedServices: v.optional(v.any()),
    extractedKeywords: v.optional(v.any()),
    extractedVoice: v.optional(v.any()),
    contentAnalysis: v.optional(v.any()),
    similarityScore: v.optional(v.number()),
    threatLevel: v.optional(v.string()), // 'low' | 'medium' | 'high' | 'critical'
    lastResearchAt: v.optional(v.number()),
    lastCrawlAt: v.optional(v.number()),
  })
    .index("by_brand_profile", ["brandProfileId"])
    .index("by_domain", ["domain"]),

  // ============ TIER 7: Agent System & Credits ============

  /**
   * Customer credits - balance tracking for AI agent usage
   */
  credits: defineTable({
    userId: v.string(), // Clerk user ID
    workspaceId: v.id("workspaces"),
    balance: v.number(), // Current credit balance
    tier: v.string(), // 'free' | 'core' | 'growth' | 'enterprise'
    monthlyAllowance: v.number(), // Monthly credit allocation
    bonusCredits: v.optional(v.number()), // One-time bonus credits
    resetDay: v.number(), // Day of month for reset (1-28)
    lastResetAt: v.optional(v.number()), // Unix timestamp
    // Tier-specific features
    enabledAgents: v.optional(v.any()), // Array of enabled agent IDs
    concurrencyLimit: v.optional(v.number()), // Max parallel jobs
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"]),

  /**
   * Usage log - detailed tracking of all agent executions
   */
  usageLog: defineTable({
    userId: v.string(),
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    agentId: v.string(), // 'seo-writer' | 'social-creator' | etc.
    jobId: v.optional(v.string()), // Inngest job ID
    // Resource tracking
    articleId: v.optional(v.id("articles")),
    briefId: v.optional(v.id("contentBriefs")),
    // Usage metrics
    creditsUsed: v.number(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    // Cost tracking (for internal analytics)
    estimatedCostCents: v.optional(v.number()), // Actual API cost in cents
    // Status
    status: v.string(), // 'pending' | 'running' | 'completed' | 'failed'
    errorMessage: v.optional(v.string()),
    // Timing
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_agent", ["agentId"])
    .index("by_job", ["jobId"])
    .index("by_date", ["startedAt"]),

  /**
   * Agent jobs - track async Inngest job execution
   */
  agentJobs: defineTable({
    inngestEventId: v.string(), // Inngest event ID for tracking
    userId: v.string(),
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    // Job definition
    agentId: v.string(),
    eventType: v.string(), // 'article/generate' | 'content/generate-social-posts' | etc.
    inputData: v.any(), // Event payload
    // Status tracking
    status: v.string(), // 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
    progress: v.optional(v.number()), // 0-100
    currentStep: v.optional(v.string()),
    // Results
    result: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    // Credits
    creditsReserved: v.number(), // Reserved on job start
    creditsUsed: v.optional(v.number()), // Actual usage (may differ)
    // Timing
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_inngest_event", ["inngestEventId"])
    .index("by_user", ["userId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_project", ["projectId"]),

  /**
   * Content assets - repurposed content from articles
   * Social posts, ad copies, press releases, newsletters, etc.
   */
  contentAssets: defineTable({
    projectId: v.id("projects"),
    articleId: v.optional(v.id("articles")),
    jobId: v.optional(v.string()), // Inngest job that created this
    // Asset type
    assetType: v.string(), // 'social_post' | 'ad_copy' | 'press_release' | 'newsletter' | 'linkbait'
    platform: v.optional(v.string()), // 'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'google' | 'meta'
    accountType: v.optional(v.string()), // 'company' | 'employee'
    // Content
    title: v.optional(v.string()),
    content: v.string(),
    contentJson: v.optional(v.any()), // Structured content (e.g., press release sections)
    // Metadata
    metadata: v.optional(v.any()), // Platform-specific data (hashtags, CTAs, etc.)
    // Status
    status: v.string(), // 'draft' | 'approved' | 'scheduled' | 'published'
    scheduledFor: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    externalId: v.optional(v.string()), // ID from platform after publishing
    externalUrl: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_article", ["articleId"])
    .index("by_type", ["assetType"])
    .index("by_platform", ["platform"]),

  // ============ TIER 8: Utility Tables ============

  /**
   * Research cache - keyword research and URL scraping cache
   */
  researchCache: defineTable({
    key: v.string(),
    cacheType: v.string(), // 'url_scrape' | 'keyword_serp'
    data: v.any(),
    expiresAt: v.number(),
  })
    .index("by_key_type", ["key", "cacheType"]),

  /**
   * Changelog - application version history
   */
  changelog: defineTable({
    version: v.string(),
    title: v.string(),
    entries: v.any(), // Array of changelog entries
    releaseDate: v.string(),
  })
    .index("by_version", ["version"]),

  /**
   * Migration mappings - temporary table for Supabase ID to Convex ID mapping
   * Used during data migration, can be deleted after migration is complete
   */
  migrationMappings: defineTable({
    supabaseTable: v.string(),
    supabaseId: v.string(), // Original UUID from Supabase
    convexId: v.string(), // New Convex ID
  })
    .index("by_supabase", ["supabaseTable", "supabaseId"]),
});
