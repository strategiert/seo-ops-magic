-- Create table for HTML exports
CREATE TABLE public.html_exports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    html_content TEXT NOT NULL,
    design_variant TEXT DEFAULT 'default',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.html_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view html_exports in own projects"
ON public.html_exports
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM projects p
    JOIN workspaces w ON p.workspace_id = w.id
    WHERE p.id = html_exports.project_id
    AND w.owner_id = auth.uid()
));

CREATE POLICY "Users can manage html_exports in own projects"
ON public.html_exports
FOR ALL
USING (EXISTS (
    SELECT 1 FROM projects p
    JOIN workspaces w ON p.workspace_id = w.id
    WHERE p.id = html_exports.project_id
    AND w.owner_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_html_exports_updated_at
BEFORE UPDATE ON public.html_exports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_html_exports_article_id ON public.html_exports(article_id);
CREATE INDEX idx_html_exports_project_id ON public.html_exports(project_id);