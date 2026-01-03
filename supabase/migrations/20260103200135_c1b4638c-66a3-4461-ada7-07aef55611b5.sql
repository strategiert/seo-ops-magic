-- Migration tracking table
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  executed_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view migrations"
  ON public.schema_migrations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert migrations"
  ON public.schema_migrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = executed_by);