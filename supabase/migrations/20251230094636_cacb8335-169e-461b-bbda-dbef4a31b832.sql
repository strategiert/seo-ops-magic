-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workspaces table
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  domain TEXT,
  wp_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create integrations table for API keys (encrypted)
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('neuronwriter', 'gsc', 'wordpress')),
  credentials_encrypted TEXT,
  is_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, type)
);

-- Create content_briefs table
CREATE TABLE public.content_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  primary_keyword TEXT NOT NULL,
  search_intent TEXT CHECK (search_intent IN ('informational', 'transactional', 'navigational', 'commercial')),
  target_audience TEXT,
  tonality TEXT,
  target_length INTEGER,
  notes TEXT,
  nw_guidelines JSONB,
  priority_score INTEGER DEFAULT 50,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create articles table
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  brief_id UUID REFERENCES public.content_briefs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  primary_keyword TEXT,
  content_markdown TEXT,
  content_html TEXT,
  meta_title TEXT,
  meta_description TEXT,
  faq_json JSONB,
  outline_json JSONB,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create elementor_templates table
CREATE TABLE public.elementor_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  template_json JSONB NOT NULL,
  design_preset TEXT DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elementor_templates ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Workspaces policies
CREATE POLICY "Users can view own workspaces" ON public.workspaces FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can create workspaces" ON public.workspaces FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own workspaces" ON public.workspaces FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own workspaces" ON public.workspaces FOR DELETE USING (auth.uid() = owner_id);

-- Projects policies (via workspace ownership)
CREATE POLICY "Users can view projects in own workspaces" ON public.projects FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid()));
CREATE POLICY "Users can create projects in own workspaces" ON public.projects FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid()));
CREATE POLICY "Users can update projects in own workspaces" ON public.projects FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid()));
CREATE POLICY "Users can delete projects in own workspaces" ON public.projects FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid()));

-- Integrations policies (via project -> workspace ownership)
CREATE POLICY "Users can view integrations in own projects" ON public.integrations FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.projects p 
    JOIN public.workspaces w ON p.workspace_id = w.id 
    WHERE p.id = project_id AND w.owner_id = auth.uid()
  ));
CREATE POLICY "Users can manage integrations in own projects" ON public.integrations FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.projects p 
    JOIN public.workspaces w ON p.workspace_id = w.id 
    WHERE p.id = project_id AND w.owner_id = auth.uid()
  ));

-- Content briefs policies
CREATE POLICY "Users can view briefs in own projects" ON public.content_briefs FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.projects p 
    JOIN public.workspaces w ON p.workspace_id = w.id 
    WHERE p.id = project_id AND w.owner_id = auth.uid()
  ));
CREATE POLICY "Users can manage briefs in own projects" ON public.content_briefs FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.projects p 
    JOIN public.workspaces w ON p.workspace_id = w.id 
    WHERE p.id = project_id AND w.owner_id = auth.uid()
  ));

-- Articles policies
CREATE POLICY "Users can view articles in own projects" ON public.articles FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.projects p 
    JOIN public.workspaces w ON p.workspace_id = w.id 
    WHERE p.id = project_id AND w.owner_id = auth.uid()
  ));
CREATE POLICY "Users can manage articles in own projects" ON public.articles FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.projects p 
    JOIN public.workspaces w ON p.workspace_id = w.id 
    WHERE p.id = project_id AND w.owner_id = auth.uid()
  ));

-- Elementor templates policies
CREATE POLICY "Users can view templates in own projects" ON public.elementor_templates FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.projects p 
    JOIN public.workspaces w ON p.workspace_id = w.id 
    WHERE p.id = project_id AND w.owner_id = auth.uid()
  ));
CREATE POLICY "Users can manage templates in own projects" ON public.elementor_templates FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.projects p 
    JOIN public.workspaces w ON p.workspace_id = w.id 
    WHERE p.id = project_id AND w.owner_id = auth.uid()
  ));

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Auto-create a default workspace for new users
  INSERT INTO public.workspaces (name, owner_id)
  VALUES ('Mein Workspace', NEW.id);
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update triggers to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_content_briefs_updated_at BEFORE UPDATE ON public.content_briefs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_elementor_templates_updated_at BEFORE UPDATE ON public.elementor_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();