-- Add WordPress post ID column to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS wp_post_id INTEGER;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS articles_wp_post_id_idx ON articles(wp_post_id);

-- Add comment for documentation
COMMENT ON COLUMN articles.wp_post_id IS 'WordPress post ID after publishing to headless WordPress';
