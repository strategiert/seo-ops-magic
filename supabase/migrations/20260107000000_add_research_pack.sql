-- Add research_pack field to content_briefs
-- This stores the structured ResearchPack for the new content generation pipeline

ALTER TABLE public.content_briefs
ADD COLUMN IF NOT EXISTS research_pack JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.content_briefs.research_pack IS 'Structured ResearchPack containing keyword requirements, SERP data, recommendations for content generation';

-- Index for faster queries on research_pack fields
CREATE INDEX IF NOT EXISTS idx_content_briefs_research_pack
ON public.content_briefs USING gin (research_pack);
