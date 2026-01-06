-- Migration: Article Design Recipes
-- Separates LLM layout decisions (JSON) from HTML rendering

-- Design Recipes: LLM-generated layout instructions as JSON
create table if not exists public.article_design_recipes (
  id bigserial primary key,
  article_id uuid not null unique references public.articles(id) on delete cascade,
  recipe_version text not null default 'v1',
  provider text, -- 'gemini', 'openai', 'anthropic', 'fallback'
  recipe_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for lookups
create index if not exists idx_article_design_recipes_article_id on public.article_design_recipes(article_id);

-- RLS
alter table public.article_design_recipes enable row level security;

-- Allow service role and authenticated users to manage recipes
create policy "Service role full access on article_design_recipes"
  on public.article_design_recipes
  for all
  using (true)
  with check (true);

-- Add recipe_version column to html_exports if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'html_exports' and column_name = 'recipe_version'
  ) then
    alter table public.html_exports add column recipe_version text;
  end if;
end $$;
