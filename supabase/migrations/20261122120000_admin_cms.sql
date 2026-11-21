-- Admin dashboard / CMS.
-- The database becomes the source of truth for Quick Talk, the dictionary and lessons
-- (src/content/*.ts is only the starter import). Also: fixed translations, UI text overrides,
-- content sources, lesson items. Reads stay public (RLS "public read"); every write goes
-- through the server with the service role after an ADMIN_EMAILS check, and is audited.

-- ---------- Dictionary fields on expressions (slug "slang-<word>", category "slang:<kind>") ----------
alter table public.expressions
  add column term text check (char_length(term) <= 200),  -- the headword shown in the dictionary
  add column term_lang public.lang,                       -- language of the headword
  add column origin text check (origin in ('albanian', 'turkish', 'serbian', 'german', 'english', 'latin')),
  add column example_tr text check (char_length(example_tr) <= 500),
  add column example_sq text check (char_length(example_sq) <= 500),
  add column sources text[] not null default '{}',
  add column verified boolean not null default false,     -- checked by a native Prishtina speaker
  add column sort_order int not null default 0;

-- ---------- Content sources shown on dictionary pages ----------
create table public.content_sources (
  id text primary key check (id ~ '^[a-zA-Z0-9_-]{1,40}$'),
  label text not null check (char_length(label) between 1 and 300),
  url text check (url is null or url ~ '^https://'),
  sort_order int not null default 0
);

-- ---------- Lessons: bilingual situation, track description/icon, items ----------
alter table public.courses
  add column description_tr text not null default '',
  add column description_sq text not null default '',
  add column icon text not null default 'message' check (icon in ('plane', 'map', 'message'));
alter table public.lessons add column situation_sq text not null default '';

create table public.lesson_items (
  -- Stable id: learning progress (user_item_stats.item_id) is keyed by it. Never reuse.
  id text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  sq text not null check (char_length(sq) between 1 and 300),
  tr text not null check (char_length(tr) between 1 and 300),
  note_tr text check (char_length(note_tr) <= 300),
  note_sq text check (char_length(note_sq) <= 300),
  sort_order int not null default 0
);
create index lesson_items_lesson_id_idx on public.lesson_items (lesson_id, sort_order);

-- ---------- Fixed translations: used by the Translate page before asking the AI ----------
create table public.fixed_translations (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('tr-sq', 'sq-tr')),
  variant text not null default 'standard' check (variant in ('standard', 'kosovan')),
  source_text text not null check (char_length(source_text) between 1 and 1000),
  source_normalized text generated always as (
    btrim(regexp_replace(public.normalize_text(source_text), '[[:punct:]]+$', ''))
  ) stored,
  translation text not null check (char_length(translation) between 1 and 4000),
  notes jsonb not null default '[]'::jsonb check (jsonb_typeof(notes) = 'array'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- sq→tr has no style choice: always 'standard'.
  check (direction = 'tr-sq' or variant = 'standard'),
  unique (direction, variant, source_normalized)
);
create trigger fixed_translations_updated_at before update on public.fixed_translations
  for each row execute function public.set_updated_at();

-- ---------- UI text overrides (dotted keys into messages/<locale>.json) ----------
create table public.ui_texts (
  locale public.lang not null,
  key text not null check (key ~ '^[A-Za-z0-9_.]{1,200}$'),
  value text not null check (char_length(value) <= 4000),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (locale, key)
);
create trigger ui_texts_updated_at before update on public.ui_texts
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.content_sources enable row level security;
alter table public.lesson_items enable row level security;
alter table public.ui_texts enable row level security;
alter table public.fixed_translations enable row level security;

create policy "content_sources: public read" on public.content_sources for select to anon, authenticated using (true);
create policy "lesson_items: public read" on public.lesson_items for select to anon, authenticated using (true);
create policy "ui_texts: public read" on public.ui_texts for select to anon, authenticated using (true);
-- fixed_translations: no policies. Only the server (service role) reads or writes them.

revoke insert, update, delete, truncate on public.content_sources, public.lesson_items, public.ui_texts from anon, authenticated;
revoke all on public.fixed_translations from anon, authenticated;
revoke select (updated_by) on public.ui_texts from anon, authenticated;
grant select (locale, key, value, updated_at) on public.ui_texts to anon, authenticated;

-- ---------- Admin write helpers (service role only) ----------

-- Upsert one expression with its standard TR/SQ texts (and optional Kosovan form).
create or replace function public.admin_upsert_expression(
  p_slug text,
  p_category text,
  p_tr text,
  p_sq text,
  p_sq_kosovo text default null,
  p_tr_dialect public.dialect default 'standard'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eid uuid;
begin
  insert into public.expressions (slug, category) values (p_slug, p_category)
  on conflict (slug) do update set category = excluded.category
  returning id into eid;

  -- The Turkish text has exactly one row (its dialect may change between standard / turkish_slang).
  delete from public.variants where expression_id = eid and lang = 'tr' and dialect <> p_tr_dialect;
  insert into public.variants (expression_id, lang, dialect, text) values (eid, 'tr', p_tr_dialect, p_tr)
  on conflict (expression_id, lang, dialect) do update set text = excluded.text;

  insert into public.variants (expression_id, lang, dialect, text) values (eid, 'sq', 'standard', p_sq)
  on conflict (expression_id, lang, dialect) do update set text = excluded.text;

  if nullif(btrim(coalesce(p_sq_kosovo, '')), '') is null then
    delete from public.variants where expression_id = eid and lang = 'sq' and dialect = 'gheg';
  else
    insert into public.variants (expression_id, lang, dialect, text) values (eid, 'sq', 'gheg', p_sq_kosovo)
    on conflict (expression_id, lang, dialect) do update set text = excluded.text;
  end if;
  return eid;
end;
$$;

-- Save a Quick Talk phrase: texts, category, fill-in options, reply buttons and audio.
create or replace function public.admin_save_phrase(
  p_slug text,                 -- "qt-<id>"
  p_category_slug text,
  p_tr text,
  p_sq text,
  p_slots jsonb,               -- null or [{ "tr": "...", "sq": "..." }]
  p_reply_slugs text[],        -- ["reply-yes", ...] in order
  p_audio text,                -- public path or null
  p_sort_order int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
  eid uuid;
  pid uuid;
  r text;
  i int := 0;
begin
  select id into cid from public.phrase_categories where slug = p_category_slug;
  if cid is null then raise exception 'unknown category %', p_category_slug using errcode = '22023'; end if;

  eid := public.admin_upsert_expression(p_slug, p_category_slug, p_tr, p_sq);
  update public.variants set audio_path = nullif(btrim(coalesce(p_audio, '')), '')
  where expression_id = eid and lang = 'sq' and dialect = 'standard';

  insert into public.phrases (slug, category_id, expression_id, has_slots, slots, sort_order)
  values (p_slug, cid, eid, p_slots is not null, p_slots, p_sort_order)
  on conflict (slug) do update set category_id = excluded.category_id, expression_id = excluded.expression_id,
    has_slots = excluded.has_slots, slots = excluded.slots, sort_order = excluded.sort_order
  returning id into pid;

  delete from public.reply_buttons where phrase_id = pid;
  foreach r in array coalesce(p_reply_slugs, '{}') loop
    insert into public.reply_buttons (phrase_id, expression_id, sort_order)
    select pid, e.id, i from public.expressions e where e.slug = r and e.category = 'reply'
    on conflict do nothing;
    i := i + 1;
  end loop;
end;
$$;

-- Replace a lesson's items in one go (keeps ids, so progress stays attached).
create or replace function public.admin_save_lesson_items(p_lesson_slug text, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  lid uuid;
  item jsonb;
  i int := 0;
  ids text[] := '{}';
begin
  select id into lid from public.lessons where slug = p_lesson_slug;
  if lid is null then raise exception 'unknown lesson %', p_lesson_slug using errcode = '22023'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'items must be an array' using errcode = '22023'; end if;

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.lesson_items (id, lesson_id, sq, tr, note_tr, note_sq, sort_order)
    values (item ->> 'id', lid, item ->> 'sq', item ->> 'tr', nullif(item ->> 'note_tr', ''), nullif(item ->> 'note_sq', ''), i)
    on conflict (id) do update set lesson_id = excluded.lesson_id, sq = excluded.sq, tr = excluded.tr,
      note_tr = excluded.note_tr, note_sq = excluded.note_sq, sort_order = excluded.sort_order;
    ids := ids || (item ->> 'id');
    i := i + 1;
  end loop;
  delete from public.lesson_items where lesson_id = lid and not (id = any (ids));
end;
$$;

revoke execute on function public.admin_upsert_expression(text, text, text, text, text, public.dialect) from public, anon, authenticated;
revoke execute on function public.admin_save_phrase(text, text, text, text, jsonb, text[], text, int) from public, anon, authenticated;
revoke execute on function public.admin_save_lesson_items(text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_upsert_expression(text, text, text, text, text, public.dialect) to service_role;
grant execute on function public.admin_save_phrase(text, text, text, text, jsonb, text[], text, int) to service_role;
grant execute on function public.admin_save_lesson_items(text, jsonb) to service_role;

-- ---------- Admin overview numbers (service role only) ----------
create or replace function public.admin_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'premium', (select count(distinct user_id) from public.subscriptions where status = 'active' and current_period_end > now()),
    'translations_today', (select coalesce(sum(text_translations), 0) from public.usage_counters
                           where day = (now() at time zone 'Europe/Belgrade')::date),
    'ai_spend_today_eur', (select coalesce(sum(cost_eur), 0) from public.ai_spend_daily
                           where day = (now() at time zone 'UTC')::date),  -- the spend cap counts UTC days
    'pending_reports', (select count(*) from public.corrections where status = 'pending'),
    'fixed_translations', (select count(*) from public.fixed_translations),
    'phrases', (select count(*) from public.phrases),
    'words', (select count(*) from public.expressions where category like 'slang:%'),
    'lessons', (select count(*) from public.lessons)
  )
$$;
revoke execute on function public.admin_overview() from public, anon, authenticated;
grant execute on function public.admin_overview() to service_role;

-- Translate page: the admin's fixed translation for this exact text (same normalization as the table).
create or replace function public.find_fixed_translation(p_direction text, p_variant text, p_text text)
returns table (translation text, notes jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select f.translation, f.notes from public.fixed_translations f
  where f.direction = p_direction
    and f.variant = case when p_direction = 'sq-tr' then 'standard' else p_variant end
    and f.source_normalized = btrim(regexp_replace(public.normalize_text(p_text), '[[:punct:]]+$', ''))
  limit 1
$$;
revoke execute on function public.find_fixed_translation(text, text, text) from public, anon, authenticated;
grant execute on function public.find_fixed_translation(text, text, text) to service_role;

-- Admin → Users: search accounts by email, with their current Premium status (service role only).
create or replace function public.admin_find_users(p_query text default '', p_premium_only boolean default false, p_limit int default 50)
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, premium_until timestamptz, plan_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, s.current_period_end, s.plan_id
  from auth.users u
  left join lateral (
    select current_period_end, plan_id from public.subscriptions
    where user_id = u.id and status = 'active' and current_period_end > now()
    order by current_period_end desc limit 1
  ) s on true
  where (coalesce(p_query, '') = '' or u.email ilike '%' || p_query || '%')
    and (not p_premium_only or s.current_period_end is not null)
  order by u.created_at desc
  limit least(greatest(p_limit, 1), 200)
$$;
revoke execute on function public.admin_find_users(text, boolean, int) from public, anon, authenticated;
grant execute on function public.admin_find_users(text, boolean, int) to service_role;
