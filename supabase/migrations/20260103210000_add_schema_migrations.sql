-- Migration tracking table for in-app migration system
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  executed_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view migrations
CREATE POLICY "Authenticated users can view migrations"
  ON public.schema_migrations
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert (via Edge Function)
-- No INSERT policy for authenticated = only service role can write

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS schema_migrations_version_idx
  ON public.schema_migrations(version);

-- Comment for documentation
COMMENT ON TABLE public.schema_migrations IS 'Tracks executed database migrations for the in-app migration system';
