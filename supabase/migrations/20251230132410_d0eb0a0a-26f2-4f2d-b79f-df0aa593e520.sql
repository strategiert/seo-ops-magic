-- Add nw_query_id column for tracking ongoing NeuronWriter analysis
ALTER TABLE public.content_briefs 
ADD COLUMN IF NOT EXISTS nw_query_id text;

-- Add comment for documentation
COMMENT ON COLUMN public.content_briefs.nw_query_id IS 'Stores the NeuronWriter query ID for tracking ongoing analysis';