-- WordPress integration fields for credentials storage
ALTER TABLE public.integrations
ADD COLUMN IF NOT EXISTS wp_username TEXT,
ADD COLUMN IF NOT EXISTS wp_app_password TEXT,
ADD COLUMN IF NOT EXISTS wp_site_name TEXT,
ADD COLUMN IF NOT EXISTS wp_is_verified BOOLEAN DEFAULT false;

-- Index for faster WordPress integration lookups
CREATE INDEX IF NOT EXISTS integrations_wordpress_idx
ON public.integrations(project_id)
WHERE type = 'wordpress';
