-- Stable slugs for units and lessons, matching src/content/lessons.ts, so content can be
-- upserted and progress can reference lessons by slug.

alter table public.units add column slug text unique;
alter table public.lessons add column slug text unique;
