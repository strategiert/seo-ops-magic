-- Migration: Brand Intelligence System
-- Adds tables for comprehensive brand research, competitor analysis, and job tracking

-- ============================================================================
-- 1. BRAND RESEARCH JOBS - Progress tracking for long-running operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brand_research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_profile_id UUID REFERENCES public.brand_profiles(id) ON DELETE CASCADE NOT NULL,

  -- Job Type
  job_type TEXT NOT NULL CHECK (job_type IN (
    'full_discovery',
    'sitemap_crawl',
    'perplexity_research',
    'competitor_analysis',
    'competitor_crawl'
  )),

  -- Configuration
  config JSONB DEFAULT '{}'::jsonb,

  -- Progress Tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step TEXT,
  steps_completed INTEGER DEFAULT 0,
  steps_total INTEGER DEFAULT 1,

  -- Results & Errors
  result JSONB,
  error_message TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_research_jobs_profile ON brand_research_jobs(brand_profile_id);
CREATE INDEX idx_brand_research_jobs_status ON brand_research_jobs(status);
CREATE INDEX idx_brand_research_jobs_type ON brand_research_jobs(job_type);

-- ============================================================================
-- 2. BRAND RESEARCH RESULTS - Perplexity research cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brand_research_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_profile_id UUID REFERENCES public.brand_profiles(id) ON DELETE CASCADE NOT NULL,

  -- Research Type
  research_type TEXT NOT NULL CHECK (research_type IN (
    'market_analysis',
    'industry_trends',
    'brand_perception',
    'audience_insights',
    'content_gaps',
    'pricing_intelligence',
    'technology_stack'
  )),

  -- Query & Results
  query_context JSONB,
  result_data JSONB NOT NULL,
  citations JSONB DEFAULT '[]'::jsonb,

  -- Cache Management
  cache_key TEXT,
  expires_at TIMESTAMPTZ,

  -- Meta
  model_used TEXT,
  token_count INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(brand_profile_id, research_type, cache_key)
);

CREATE INDEX idx_brand_research_results_type ON brand_research_results(brand_profile_id, research_type);
CREATE INDEX idx_brand_research_results_cache ON brand_research_results(cache_key, expires_at);

-- ============================================================================
-- 3. BRAND COMPETITOR PROFILES - Detailed competitor data
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brand_competitor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_profile_id UUID REFERENCES public.brand_profiles(id) ON DELETE CASCADE NOT NULL,

  -- Competitor Info (from Perplexity research)
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  description TEXT,
  industry TEXT,

  -- Analysis (from Perplexity)
  strengths JSONB DEFAULT '[]'::jsonb,
  weaknesses JSONB DEFAULT '[]'::jsonb,
  market_position TEXT,
  unique_selling_points JSONB DEFAULT '[]'::jsonb,

  -- Crawled Data
  crawl_status TEXT DEFAULT 'pending' CHECK (crawl_status IN ('pending', 'crawling', 'completed', 'failed', 'skipped')),
  crawl_job_id TEXT,
  pages_crawled INTEGER DEFAULT 0,

  -- Extracted Brand Info (from crawl)
  extracted_tagline TEXT,
  extracted_products JSONB DEFAULT '[]'::jsonb,
  extracted_services JSONB DEFAULT '[]'::jsonb,
  extracted_keywords JSONB DEFAULT '[]'::jsonb,
  extracted_voice JSONB,
  content_analysis JSONB,

  -- Comparison Scores
  similarity_score NUMERIC(5,2),
  threat_level TEXT CHECK (threat_level IN ('low', 'medium', 'high', 'critical')),

  -- Meta
  last_research_at TIMESTAMPTZ,
  last_crawl_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(brand_profile_id, domain)
);

CREATE INDEX idx_brand_competitor_profiles_brand ON brand_competitor_profiles(brand_profile_id);
CREATE INDEX idx_brand_competitor_profiles_domain ON brand_competitor_profiles(domain);

-- ============================================================================
-- 4. EXTEND BRAND_PROFILES - Add new columns for enhanced discovery
-- ============================================================================

-- Sitemap & Discovery
ALTER TABLE public.brand_profiles
ADD COLUMN IF NOT EXISTS sitemap_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS discovered_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS crawl_config JSONB DEFAULT '{"max_pages": 50, "priority_paths": [], "exclude_paths": []}'::jsonb;

-- Perplexity Research Results (summary fields)
ALTER TABLE public.brand_profiles
ADD COLUMN IF NOT EXISTS market_position JSONB,
ADD COLUMN IF NOT EXISTS industry_insights JSONB,
ADD COLUMN IF NOT EXISTS external_perception JSONB,
ADD COLUMN IF NOT EXISTS audience_insights JSONB,
ADD COLUMN IF NOT EXISTS content_gaps JSONB;

-- Research Tracking
ALTER TABLE public.brand_profiles
ADD COLUMN IF NOT EXISTS last_research_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS research_status TEXT DEFAULT 'pending' CHECK (research_status IN ('pending', 'running', 'completed', 'failed'));

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.brand_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_research_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_competitor_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brand_research_jobs
CREATE POLICY "Users can view their own research jobs"
  ON public.brand_research_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_research_jobs.brand_profile_id
      AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own research jobs"
  ON public.brand_research_jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_research_jobs.brand_profile_id
      AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own research jobs"
  ON public.brand_research_jobs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_research_jobs.brand_profile_id
      AND w.owner_id = auth.uid()
    )
  );

-- RLS Policies for brand_research_results
CREATE POLICY "Users can view their own research results"
  ON public.brand_research_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_research_results.brand_profile_id
      AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own research results"
  ON public.brand_research_results
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_research_results.brand_profile_id
      AND w.owner_id = auth.uid()
    )
  );

-- RLS Policies for brand_competitor_profiles
CREATE POLICY "Users can view their own competitor profiles"
  ON public.brand_competitor_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_competitor_profiles.brand_profile_id
      AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own competitor profiles"
  ON public.brand_competitor_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_competitor_profiles.brand_profile_id
      AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_brand_research_jobs_updated_at
  BEFORE UPDATE ON public.brand_research_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_competitor_profiles_updated_at
  BEFORE UPDATE ON public.brand_competitor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
