-- Language content: expressions (a meaning) with variants (one per language/dialect),
-- Quick Talk phrases, reply buttons, and the learning tracks.
-- Read-only to everyone (including logged-out users). Writes go through the server
-- with the service_role key, or the dashboard for admins.

-- ---------- Expressions & variants ----------
create table public.expressions (
  id uuid primary key default gen_random_uuid(),
  slug text unique,                         -- stable id, e.g. "qt-d1" or "kanka"
  category text,
  situation text,
  register public.register not null default 'neutral',
  notes_tr text,
  notes_sq text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  expression_id uuid not null references public.expressions (id) on delete cascade,
  lang public.lang not null,
  dialect public.dialect not null default 'standard',
  text text not null check (char_length(text) between 1 and 500),
  text_normalized text generated always as (public.normalize_text(text)) stored,
  audio_path text,                          -- storage path of recorded native audio
  -- 1536 dims fits common embedding models. Change in a new migration if the model differs.
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expression_id, lang, dialect)
);

create index variants_expression_id_idx on public.variants (expression_id);
create index variants_text_normalized_idx on public.variants (text_normalized);
create index variants_text_trgm_idx on public.variants using gin (text_normalized extensions.gin_trgm_ops);
create index variants_embedding_idx on public.variants using hnsw (embedding extensions.vector_cosine_ops);

-- ---------- Quick Talk ----------
create table public.phrase_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_tr text not null,
  name_sq text not null,
  icon text not null,                       -- Lucide icon key, see src/components/icons.tsx
  sort_order int not null default 0,
  basic_pack boolean not null default false -- part of the free "everyday basics" offline pack
);

create table public.phrases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category_id uuid not null references public.phrase_categories (id) on delete cascade,
  expression_id uuid not null references public.expressions (id) on delete restrict,
  has_slots boolean not null default false,
  slots jsonb,                              -- [{ "tr": "A", "sq": "A" }, ...] when has_slots
  sort_order int not null default 0,
  offline_pack text not null default 'basic',
  check (not has_slots or jsonb_typeof(slots) = 'array')
);

create index phrases_category_id_idx on public.phrases (category_id, sort_order);
create index phrases_expression_id_idx on public.phrases (expression_id);

create table public.reply_buttons (
  id uuid primary key default gen_random_uuid(),
  phrase_id uuid not null references public.phrases (id) on delete cascade,
  expression_id uuid not null references public.expressions (id) on delete restrict,
  sort_order int not null default 0,
  unique (phrase_id, expression_id)
);

create index reply_buttons_expression_id_idx on public.reply_buttons (expression_id);

-- ---------- Learning tracks ----------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_tr text not null,
  title_sq text not null,
  sort_order int not null default 0,
  is_free boolean not null default false
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title_tr text not null,
  title_sq text not null,
  sort_order int not null default 0,
  is_free boolean not null default false
);
create index units_course_id_idx on public.units (course_id, sort_order);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  title_tr text not null,
  title_sq text not null,
  situation text,
  sort_order int not null default 0
);
create index lessons_unit_id_idx on public.lessons (unit_id, sort_order);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  type public.exercise_type not null,
  content jsonb not null,
  sort_order int not null default 0
);
create index exercises_lesson_id_idx on public.exercises (lesson_id, sort_order);

-- ---------- updated_at ----------
create trigger expressions_updated_at before update on public.expressions
  for each row execute function public.set_updated_at();
create trigger variants_updated_at before update on public.variants
  for each row execute function public.set_updated_at();

-- ---------- RLS: public read, no client writes ----------
do $$
declare t text;
begin
  foreach t in array array['expressions', 'variants', 'phrase_categories', 'phrases', 'reply_buttons',
                           'courses', 'units', 'lessons', 'exercises']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: public read" on public.%I for select to anon, authenticated using (true)', t, t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;
