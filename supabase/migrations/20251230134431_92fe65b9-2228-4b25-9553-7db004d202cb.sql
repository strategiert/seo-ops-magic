-- Drop existing status check constraint
ALTER TABLE content_briefs DROP CONSTRAINT IF EXISTS content_briefs_status_check;

-- Recreate constraint with pending status included
ALTER TABLE content_briefs ADD CONSTRAINT content_briefs_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'draft'::text, 'in_progress'::text, 'completed'::text]));