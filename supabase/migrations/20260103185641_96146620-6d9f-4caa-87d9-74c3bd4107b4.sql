CREATE TABLE changelog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    release_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entries JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE changelog ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Changelog is publicly readable"
    ON changelog
    FOR SELECT
    USING (true);

  CREATE INDEX changelog_release_date_idx ON changelog(release_date DESC);