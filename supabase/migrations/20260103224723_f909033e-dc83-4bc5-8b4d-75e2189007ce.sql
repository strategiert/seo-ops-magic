-- Brand Profiles Table
-- Stores brand intelligence data extracted from website crawling and AI analysis

CREATE TABLE IF NOT EXISTS public.brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Core Brand Identity
  brand_name TEXT,
  tagline TEXT,
  mission_statement TEXT,
  brand_story TEXT,

  -- JSONB Fields for complex data
  brand_voice JSONB DEFAULT '{"tone": [], "personality_traits": [], "writing_style": {}}'::jsonb,
  products JSONB DEFAULT '[]'::jsonb,
  services JSONB DEFAULT '[]'::jsonb,
  personas JSONB DEFAULT '[]'::jsonb,
  brand_keywords JSONB DEFAULT '{"primary": [], "secondary": [], "long_tail": []}'::jsonb,
  competitors JSONB DEFAULT '[]'::jsonb,
  visual_identity JSONB DEFAULT '{}'::jsonb,
  internal_links JSONB DEFAULT '[]'::jsonb,
  current_projects JSONB DEFAULT '[]'::jsonb,

  -- OpenAI Vector Store Reference
  openai_vector_store_id TEXT,

  -- Status Tracking
  crawl_status TEXT DEFAULT 'pending' CHECK (crawl_status IN ('pending', 'crawling', 'analyzing', 'completed', 'error')),
  crawl_error TEXT,
  last_crawl_at TIMESTAMPTZ,
  last_analysis_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for project lookups
CREATE INDEX IF NOT EXISTS idx_brand_profiles_project_id ON public.brand_profiles(project_id);

-- Enable RLS
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage brand profiles in their own projects
CREATE POLICY "Users can view brand profiles in own workspaces" ON public.brand_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE p.id = project_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert brand profiles in own workspaces" ON public.brand_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE p.id = project_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update brand profiles in own workspaces" ON public.brand_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE p.id = project_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete brand profiles in own workspaces" ON public.brand_profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE p.id = project_id AND w.owner_id = auth.uid()
    )
  );

-- Brand Crawl Data Table
-- Stores raw crawled page data for analysis

CREATE TABLE IF NOT EXISTS public.brand_crawl_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_profile_id UUID REFERENCES public.brand_profiles(id) ON DELETE CASCADE NOT NULL,

  -- Page Information
  url TEXT NOT NULL,
  page_type TEXT CHECK (page_type IN ('homepage', 'about', 'product', 'service', 'blog', 'contact', 'team', 'pricing', 'other')),

  -- Content
  title TEXT,
  content_markdown TEXT,
  meta_description TEXT,
  headings JSONB DEFAULT '[]'::jsonb,

  -- Extracted Links
  internal_links JSONB DEFAULT '[]'::jsonb,
  external_links JSONB DEFAULT '[]'::jsonb,

  -- Media
  images JSONB DEFAULT '[]'::jsonb,

  -- Relevance
  relevance_score FLOAT DEFAULT 0,

  -- Timestamps
  crawled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_brand_crawl_data_profile_id ON public.brand_crawl_data(brand_profile_id);
CREATE INDEX IF NOT EXISTS idx_brand_crawl_data_page_type ON public.brand_crawl_data(page_type);

-- Enable RLS
ALTER TABLE public.brand_crawl_data ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage crawl data through brand profiles
CREATE POLICY "Users can view crawl data in own workspaces" ON public.brand_crawl_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_profile_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert crawl data in own workspaces" ON public.brand_crawl_data
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_profile_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete crawl data in own workspaces" ON public.brand_crawl_data
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_profile_id AND w.owner_id = auth.uid()
    )
  );

-- Brand Vector Documents Table
-- Tracks documents uploaded to OpenAI Vector Store

CREATE TABLE IF NOT EXISTS public.brand_vector_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_profile_id UUID REFERENCES public.brand_profiles(id) ON DELETE CASCADE NOT NULL,

  -- OpenAI File Reference
  openai_file_id TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('brand_core', 'brand_voice', 'product', 'service', 'persona', 'competitor', 'page_content', 'keywords')),

  -- Content Info
  source_url TEXT,
  title TEXT,
  content_preview TEXT,
  token_count INTEGER,

  -- Timestamps
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_brand_vector_documents_profile_id ON public.brand_vector_documents(brand_profile_id);

-- Enable RLS
ALTER TABLE public.brand_vector_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can view vector documents in own workspaces" ON public.brand_vector_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_profile_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert vector documents in own workspaces" ON public.brand_vector_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_profile_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete vector documents in own workspaces" ON public.brand_vector_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      JOIN public.projects p ON bp.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE bp.id = brand_profile_id AND w.owner_id = auth.uid()
    )
  );