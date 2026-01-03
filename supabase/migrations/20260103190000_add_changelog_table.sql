-- Changelog table for patch notes popup
CREATE TABLE changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  release_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entries JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Everyone can read (public changelog)
ALTER TABLE changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Changelog is publicly readable"
  ON changelog
  FOR SELECT
  USING (true);

-- Index for fast loading of latest version
CREATE INDEX changelog_release_date_idx ON changelog(release_date DESC);
CREATE INDEX changelog_version_idx ON changelog(version);

-- Insert initial changelog entry
INSERT INTO changelog (version, title, release_date, entries) VALUES (
  '1.0.0',
  'Initial Release',
  '2026-01-03',
  '[
    {"type": "NEW", "text": "SEO Content Brief erstellen aus NeuronWriter"},
    {"type": "NEW", "text": "AI-gestützte Artikel-Generierung"},
    {"type": "NEW", "text": "WordPress Publishing Automation"},
    {"type": "NEW", "text": "Internal Linking System"},
    {"type": "NEW", "text": "Elementor Template Export"}
  ]'::jsonb
);
