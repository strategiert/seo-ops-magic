-- Phase 1: Erweitere integrations Tabelle für NeuronWriter-Konfiguration
ALTER TABLE public.integrations 
ADD COLUMN IF NOT EXISTS nw_project_id text,
ADD COLUMN IF NOT EXISTS nw_project_name text,
ADD COLUMN IF NOT EXISTS nw_language text DEFAULT 'de',
ADD COLUMN IF NOT EXISTS nw_engine text DEFAULT 'google.de',
ADD COLUMN IF NOT EXISTS last_sync_at timestamp with time zone;

-- Erweitere projects Tabelle für Default-Einstellungen
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'de',
ADD COLUMN IF NOT EXISTS default_country text DEFAULT 'DE',
ADD COLUMN IF NOT EXISTS default_tonality text,
ADD COLUMN IF NOT EXISTS default_target_audience text,
ADD COLUMN IF NOT EXISTS default_design_preset text DEFAULT 'default';

-- Kommentar für Dokumentation
COMMENT ON COLUMN public.integrations.nw_project_id IS 'NeuronWriter Project ID für automatischen Import';
COMMENT ON COLUMN public.integrations.nw_language IS 'Default Sprache für NW Analysen (z.B. de, en)';
COMMENT ON COLUMN public.integrations.nw_engine IS 'NW Search Engine (z.B. google.de, google.com)';