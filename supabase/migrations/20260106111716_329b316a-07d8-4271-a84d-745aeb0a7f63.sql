-- Migration: Article Design Recipes
-- Erstellt die Tabelle für Layout-Entscheidungen

create table if not exists public.article_design_recipes (
  id bigserial primary key,
  article_id uuid not null unique references public.articles(id) on delete cascade,
  recipe_version text not null default 'v1',
  provider text,
  recipe_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index für schnellere Abfragen
create index if not exists idx_article_design_recipes_article_id on public.article_design_recipes(article_id);

-- RLS (Row Level Security) aktivieren
alter table public.article_design_recipes enable row level security;

-- Zugriff für authentifizierte Nutzer basierend auf Projekt-Ownership
create policy "Users can view design recipes in own projects"
on public.article_design_recipes
for select
using (
  exists (
    select 1 from articles a
    join projects p on a.project_id = p.id
    join workspaces w on p.workspace_id = w.id
    where a.id = article_design_recipes.article_id
    and w.owner_id = auth.uid()
  )
);

create policy "Users can manage design recipes in own projects"
on public.article_design_recipes
for all
using (
  exists (
    select 1 from articles a
    join projects p on a.project_id = p.id
    join workspaces w on p.workspace_id = w.id
    where a.id = article_design_recipes.article_id
    and w.owner_id = auth.uid()
  )
);

-- Falls noch nicht vorhanden: Spalte recipe_version in html_exports hinzufügen
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'html_exports' and column_name = 'recipe_version'
  ) then
    alter table public.html_exports add column recipe_version text;
  end if;
end $$;