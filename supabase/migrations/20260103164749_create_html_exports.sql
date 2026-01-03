-- Create html_exports table for storing generated HTML landing pages
CREATE TABLE IF NOT EXISTS html_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  name text NOT NULL,
  html_content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS html_exports_article_id_idx ON html_exports(article_id);
CREATE INDEX IF NOT EXISTS html_exports_project_id_idx ON html_exports(project_id);

-- Enable RLS
ALTER TABLE html_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for authenticated users for now)
CREATE POLICY "Users can view html_exports" ON html_exports
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert html_exports" ON html_exports
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update html_exports" ON html_exports
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Users can delete html_exports" ON html_exports
  FOR DELETE TO authenticated
  USING (true);

-- Add updated_at trigger
CREATE TRIGGER set_html_exports_updated_at
  BEFORE UPDATE ON html_exports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
