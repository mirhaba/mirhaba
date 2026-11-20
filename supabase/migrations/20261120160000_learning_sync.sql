-- Sync Learn Albanian progress to the account (the phone keeps its own copy; the app merges both).
--   user_progress     one row per lesson: best score, attempts, last completion
--   user_item_stats   one row per word: spaced-repetition state for "review weak words"
--   user_learning     one row per user: the daily streak
-- Users only ever see and change their own rows. Everything cascades on account deletion.

-- ---------- Lessons: best score per lesson ----------
alter table public.user_progress
  add column attempts int not null default 0 check (attempts >= 0),
  add column completed_at timestamptz;
comment on column public.user_progress.score is 'Best first-try score (0-100) for this lesson.';
comment on column public.user_progress.streak is 'Unused: the streak lives in user_learning.';

-- ---------- Words: spaced-repetition state ----------
create table public.user_item_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 80), -- id from src/content/lessons.ts
  correct int not null default 0 check (correct >= 0),
  wrong int not null default 0 check (wrong >= 0),
  interval_days int not null default 1 check (interval_days between 1 and 365),
  due_at timestamptz not null,
  last_seen timestamptz not null,
  wrong_session text check (char_length(wrong_session) <= 200),
  primary key (user_id, item_id)
);

alter table public.user_item_stats enable row level security;
create policy "user_item_stats: own rows" on public.user_item_stats
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.user_item_stats from anon;

-- ---------- Streak ----------
create table public.user_learning (
  user_id uuid primary key references auth.users (id) on delete cascade,
  streak_current int not null default 0 check (streak_current >= 0),
  streak_longest int not null default 0 check (streak_longest >= 0),
  streak_last_day date,
  updated_at timestamptz not null default now()
);

create trigger user_learning_updated_at before update on public.user_learning
  for each row execute function public.set_updated_at();

alter table public.user_learning enable row level security;
create policy "user_learning: own row" on public.user_learning
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.user_learning from anon;

-- ---------- GDPR export: include learning data ----------
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security invoker   -- runs with the caller's RLS, so it can only ever see their own rows
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'favorites', coalesce((select jsonb_agg(to_jsonb(f)) from public.favorites f), '[]'::jsonb),
    'progress', coalesce((select jsonb_agg(jsonb_build_object(
        'lesson', l.slug, 'best_score', u.score, 'attempts', u.attempts, 'completed_at', u.completed_at))
      from public.user_progress u left join public.lessons l on l.id = u.lesson_id), '[]'::jsonb),
    'word_stats', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id') from public.user_item_stats s), '[]'::jsonb),
    'streak', (select to_jsonb(x) - 'user_id' from public.user_learning x where x.user_id = auth.uid()),
    'corrections', coalesce((select jsonb_agg(to_jsonb(c)) from public.corrections c where c.user_id = auth.uid()), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from public.consents c), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(s)) from public.subscriptions s), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'plan_id', p.plan_id, 'amount', p.amount, 'currency', p.currency,
        'status', p.status, 'created_at', p.created_at)) from public.payments p), '[]'::jsonb),
    'usage', coalesce((select jsonb_agg(to_jsonb(u)) from public.usage_counters u), '[]'::jsonb)
  )
$$;
