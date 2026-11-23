-- 1) "Wrong translation?" reports keep the source text, the app's output and the user's fix in
--    their own columns (before: squeezed into free_text, cut at 1,000 characters, so long outputs
--    were lost). Admins turn them into glossary words or fixed translations.
-- 2) Glossary: Turkish "argo" (slang) = Albanian "zhargon". The model wrote "argë" without it.

-- ---------- 1. Structured reports ----------
alter table public.corrections
  add column direction text check (direction in ('tr-sq', 'sq-tr')),
  add column variant text check (variant in ('standard', 'kosovan')),
  add column source_text text check (char_length(source_text) between 1 and 1000),
  add column output_text text check (char_length(output_text) between 1 and 4000),
  add column prompt_version text check (char_length(prompt_version) <= 64);

-- Old reports: "[tr-sq] source\n→ translation" (written by the Translate page).
update public.corrections
set direction = m[1], source_text = m[2], output_text = nullif(m[3], '')
from (
  select id, regexp_match(free_text, '^\[(tr-sq|sq-tr)\] (.*?)\n→ (.*)$', 's') as m
  from public.corrections
  where free_text is not null and source_text is null
) parsed
where public.corrections.id = parsed.id and parsed.m is not null;

-- New reports still write a short free_text ("[tr-sq] source"), so the existing
-- "variant_id or free_text" check keeps holding; nothing is dropped.
alter table public.corrections
  add constraint corrections_text_report_complete check (
    source_text is null or (direction is not null and output_text is not null)
  );

create index corrections_direction_idx on public.corrections (direction, status) where source_text is not null;

-- ---------- 2. Glossary word: argo → zhargon ----------
do $$
declare
  eid uuid;
begin
  if not exists (select 1 from public.expressions where slug = 'slang-argo') then
    eid := public.admin_upsert_expression('slang-argo', 'slang:turkish_slang', 'argo', 'zhargon', null, 'turkish_slang');
    update public.expressions set
      register = 'neutral',
      term = 'argo',
      term_lang = 'tr',
      notes_tr = 'Sokak dili, gündelik konuşma dili. Arnavutçası "zhargon"; "argë" diye bir kelime yok.',
      notes_sq = 'Gjuha e rrugës, e folura e përditshme. Në shqip: "zhargon".',
      example_tr = 'Kosova''da Arnavutça, argo dahil',
      example_sq = 'Shqipja e Kosovës, edhe me zhargon',
      sources = array['team'],
      verified = false,
      sort_order = coalesce((select max(sort_order) + 1 from public.expressions where category like 'slang:%'), 0)
    where id = eid;
  end if;
end $$;
