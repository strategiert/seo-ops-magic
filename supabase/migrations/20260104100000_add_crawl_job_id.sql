-- Add crawl_job_id column to brand_profiles
-- This stores the Firecrawl job ID so the webhook can match results to the correct profile

ALTER TABLE public.brand_profiles
ADD COLUMN IF NOT EXISTS crawl_job_id TEXT;

-- Create index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_brand_profiles_crawl_job_id ON public.brand_profiles(crawl_job_id);
