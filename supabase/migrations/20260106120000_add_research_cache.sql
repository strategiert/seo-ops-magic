-- Create research_cache table
CREATE TABLE IF NOT EXISTS research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  type TEXT NOT NULL, -- 'url_scrape', 'keyword_serp'
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  
  -- Prevent duplicate caching of same key+type
  UNIQUE(key, type)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_research_cache_lookup ON research_cache(key, type);

-- RLS Policies (Internal use mainly, but good practice)
ALTER TABLE research_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON research_cache;
CREATE POLICY "Enable read access for authenticated users" ON research_cache
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON research_cache;
CREATE POLICY "Enable insert access for authenticated users" ON research_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
