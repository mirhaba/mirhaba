-- Per-user data. Rule: a user only ever sees and changes their own rows.

-- ---------- Learning progress ----------
create table public.user_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  score smallint not null default 0 check (score between 0 and 100),
  streak int not null default 0 check (streak >= 0),
  last_seen timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index user_progress_lesson_id_idx on public.user_progress (lesson_id);

alter table public.user_progress enable row level security;
create policy "user_progress: own rows" on public.user_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.user_progress from anon;

-- ---------- Favourites (synced copy of the on-device pins; max 6) ----------
create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  phrase_id uuid not null references public.phrases (id) on delete cascade,
  position smallint not null check (position between 0 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, phrase_id),
  unique (user_id, position) deferrable initially deferred
);
create index favorites_phrase_id_idx on public.favorites (phrase_id);

alter table public.favorites enable row level security;
create policy "favorites: own rows" on public.favorites
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.favorites from anon;

-- ---------- Corrections ("Wrong translation?") ----------
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  variant_id uuid references public.variants (id) on delete set null,
  free_text text check (char_length(free_text) <= 1000),
  suggestion text not null check (char_length(suggestion) between 1 and 1000),
  status public.correction_status not null default 'pending',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (variant_id is not null or free_text is not null)
);
create index corrections_status_idx on public.corrections (status, created_at);
create index corrections_user_id_idx on public.corrections (user_id);
create index corrections_variant_id_idx on public.corrections (variant_id);
create index corrections_reviewed_by_idx on public.corrections (reviewed_by);

alter table public.corrections enable row level security;

create policy "corrections: insert own pending" on public.corrections
  for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending' and reviewed_by is null);

create policy "corrections: read own or moderate" on public.corrections
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_moderator()));

create policy "corrections: moderators review" on public.corrections
  for update to authenticated
  using ((select public.is_moderator()))
  with check ((select public.is_moderator()) and reviewed_by = (select auth.uid()));

revoke all on public.corrections from anon;
revoke delete on public.corrections from authenticated;
-- Moderators may only change the review columns.
revoke update on public.corrections from authenticated;
grant update (status, reviewed_by, reviewed_at) on public.corrections to authenticated;

-- ---------- Free-tier usage (written by the server only) ----------
create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  live_seconds int not null default 0 check (live_seconds >= 0),
  text_translations int not null default 0 check (text_translations >= 0),
  primary key (user_id, day)
);

alter table public.usage_counters enable row level security;
create policy "usage_counters: read own" on public.usage_counters
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.usage_counters from anon;
revoke insert, update, delete, truncate on public.usage_counters from authenticated;

-- ---------- Consents (proof of cookie / terms / marketing choices) ----------
-- Logged-out visitors' cookie choices are written by the server with an anon_id.
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  anon_id uuid,
  type text not null check (type in ('cookies_analytics', 'terms', 'privacy', 'marketing', 'age_16')),
  version text not null,
  granted boolean not null,
  at timestamptz not null default now(),
  check (user_id is not null or anon_id is not null)
);
create index consents_user_id_idx on public.consents (user_id, type, at desc);
create index consents_anon_id_idx on public.consents (anon_id, type, at desc);

alter table public.consents enable row level security;
create policy "consents: insert own" on public.consents
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "consents: read own" on public.consents
  for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.consents from anon;
revoke update, delete, truncate on public.consents from authenticated; -- consent history is append-only
