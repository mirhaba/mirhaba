-- Engagement features (Nov 2026):
--   1. Preferences sync: the dashboard preferences follow the account to every device.
--   2. Learn Turkish: lesson results are kept per course ('sq' = learning Albanian, 'tr' = learning Turkish).
--   3. Daily reminders: web push subscriptions and the reminder time, sent by /api/cron/reminders.
--   4. Own phrases: Quick Talk phrases people write themselves, synced like favourites.
--   5. Referrals: "invite a friend, you both get a week of Premium".
-- Plus: the GDPR export includes all of it.

-- ---------- 1. Preferences ----------
alter table public.profiles
  add column preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object' and pg_column_size(preferences) <= 4096),
  add column preferences_updated_at timestamptz;

comment on column public.profiles.preferences is 'Dashboard preferences (theme, daily goal, nickname, …). Validated by the app; the newer copy (phone or account) wins.';
comment on column public.profiles.preferences_updated_at is 'When the preferences last changed (the phone''s clock, never in the future).';

grant update (preferences, preferences_updated_at) on public.profiles to authenticated;

-- ---------- 2. Lesson results per course ----------
alter table public.user_progress
  add column course text not null default 'sq' check (course in ('sq', 'tr'));
comment on column public.user_progress.course is 'Which language was learned in this lesson: sq = Albanian (for Turkish speakers), tr = Turkish (for Albanian speakers).';

alter table public.user_progress drop constraint user_progress_pkey;
alter table public.user_progress add primary key (user_id, lesson_id, course);

-- ---------- 3. Daily reminders (web push) ----------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  -- Local time of day the reminder is sent (minutes after midnight) and the person's time zone.
  remind_at smallint not null default 1140 check (remind_at between 0 and 1439),
  time_zone text not null default 'Europe/Belgrade' check (char_length(time_zone) <= 64),
  enabled boolean not null default true,
  -- Local date of the last reminder, so nobody gets two on one day.
  last_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index push_subscriptions_enabled_idx on public.push_subscriptions (enabled) where enabled;

create trigger push_subscriptions_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: own rows" on public.push_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.push_subscriptions from anon;
-- last_sent_on is the sender's bookkeeping; users can't fake it.
revoke insert, update on public.push_subscriptions from authenticated;
grant insert (user_id, endpoint, p256dh, auth, remind_at, time_zone, enabled) on public.push_subscriptions to authenticated;
grant update (p256dh, auth, remind_at, time_zone, enabled) on public.push_subscriptions to authenticated;

-- An unknown zone would make the sender's query fail for everyone: only accept real ones.
create or replace function public.push_subscriptions_check_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.time_zone) then
    new.time_zone := 'Europe/Belgrade';
  end if;
  return new;
end $$;
revoke execute on function public.push_subscriptions_check_zone() from public, anon, authenticated;

create trigger push_subscriptions_zone before insert or update of time_zone on public.push_subscriptions
  for each row execute function public.push_subscriptions_check_zone();

-- Reminders due now: the local reminder time has passed today, none sent today, and today's
-- lesson isn't done yet (streak_last_day < local today). Called by the cron route (service_role),
-- which then sends them and marks them with mark_reminders_sent().
create or replace function public.due_reminders(max_rows int default 500)
returns table (
  id uuid,
  endpoint text,
  p256dh text,
  auth text,
  ui_lang public.lang,
  -- 'tr' when the person learns Turkish (preferences synced from the dashboard), else 'sq'.
  course text,
  streak int,
  streak_at_risk boolean,
  local_day date
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.endpoint, s.p256dh, s.auth, p.ui_lang,
    case when p.preferences ->> 'direction' = 'sq-tr' then 'tr' else 'sq' end,
    coalesce(l.streak_current, 0),
    -- Yesterday was the last lesson day: today decides whether the streak lives on.
    coalesce(l.streak_current, 0) > 0 and l.streak_last_day = (now() at time zone s.time_zone)::date - 1,
    (now() at time zone s.time_zone)::date
  from public.push_subscriptions s
  join public.profiles p on p.id = s.user_id
  left join public.user_learning l on l.user_id = s.user_id
  where s.enabled
    and (s.last_sent_on is null or s.last_sent_on < (now() at time zone s.time_zone)::date)
    and extract(hour from (now() at time zone s.time_zone)) * 60 + extract(minute from (now() at time zone s.time_zone)) >= s.remind_at
    and (l.streak_last_day is null or l.streak_last_day < (now() at time zone s.time_zone)::date)
  order by s.remind_at
  limit greatest(1, least(max_rows, 2000))
$$;
revoke execute on function public.due_reminders(int) from public, anon, authenticated;
grant execute on function public.due_reminders(int) to service_role;

-- After sending: remember the day; subscriptions the push service rejected (gone) are deleted.
create or replace function public.mark_reminders_sent(sent jsonb, gone uuid[] default '{}')
returns void
language sql
security definer
set search_path = ''
as $$
  update public.push_subscriptions s
  set last_sent_on = (x.local_day)::date
  from jsonb_to_recordset(coalesce(sent, '[]'::jsonb)) as x (id uuid, local_day text)
  where s.id = x.id;
  delete from public.push_subscriptions s where s.id = any (coalesce(gone, '{}'));
$$;
revoke execute on function public.mark_reminders_sent(jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.mark_reminders_sent(jsonb, uuid[]) to service_role;

-- ---------- 4. Own Quick Talk phrases ----------
-- One row per phrase; the id is made on the phone (works offline). `deleted` is a tombstone so a
-- delete on one phone reaches the others. The newer change wins (see src/lib/custom-phrases/merge.ts).
create table public.custom_phrases (
  user_id uuid not null references auth.users (id) on delete cascade,
  id uuid not null,
  tr text not null default '' check (char_length(tr) <= 200),
  sq text not null default '' check (char_length(sq) <= 200),
  deleted boolean not null default false,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

alter table public.custom_phrases enable row level security;

create policy "custom_phrases: own rows" on public.custom_phrases
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.custom_phrases from anon;

-- At most 50 live phrases per person (checked at commit, so a sync can rewrite the list).
create or replace function public.custom_phrases_check_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.custom_phrases c where c.user_id = new.user_id and not c.deleted) > 50 then
    raise exception 'custom_phrases: at most 50 phrases' using errcode = 'check_violation';
  end if;
  return null;
end $$;
revoke execute on function public.custom_phrases_check_limit() from public, anon, authenticated;

create constraint trigger custom_phrases_limit
  after insert or update on public.custom_phrases
  deferrable initially deferred
  for each row execute function public.custom_phrases_check_limit();

-- ---------- 5. Referrals ----------
create table public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  created_at timestamptz not null default now()
);

create table public.referrals (
  referred_id uuid primary key references auth.users (id) on delete cascade,  -- each account is invited once
  referrer_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index referrals_referrer_id_idx on public.referrals (referrer_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

create policy "referral_codes: read own" on public.referral_codes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "referrals: read own invites" on public.referrals
  for select to authenticated using ((select auth.uid()) = referrer_id or (select auth.uid()) = referred_id);

-- Only the functions below write these tables.
revoke all on public.referral_codes, public.referrals from anon;
revoke insert, update, delete on public.referral_codes, public.referrals from authenticated;

-- The caller's invite code, made on first use.
create or replace function public.my_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I: easy to read aloud
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select c.code into result from public.referral_codes c where c.user_id = uid;
  while result is null loop
    result := (select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
               from generate_series(1, 8));
    begin
      insert into public.referral_codes (user_id, code) values (uid, result);
    exception when unique_violation then
      result := null; -- code taken (or a parallel call won): try again / read theirs
      select c.code into result from public.referral_codes c where c.user_id = uid;
    end;
  end loop;
  return result;
end $$;
revoke execute on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated;

-- Called once, right after a new account gives its first consent. Gives the new account and the
-- inviter 7 days of Premium each. Refused (returns false) when: unknown code, own code, the account
-- was already invited, it is older than 7 days, or the inviter already has 10 rewarded invites.
create or replace function public.claim_referral(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inviter uuid;
  joined timestamptz;
  plan_for text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select c.user_id into inviter from public.referral_codes c where c.code = upper(trim(p_code));
  if inviter is null or inviter = uid then
    return false;
  end if;
  select u.created_at into joined from auth.users u where u.id = uid;
  if joined is null or joined < now() - interval '7 days' then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('referral:' || inviter::text, 0));
  if (select count(*) from public.referrals r where r.referrer_id = inviter) >= 10 then
    return false;
  end if;

  insert into public.referrals (referred_id, referrer_id) values (uid, inviter)
  on conflict (referred_id) do nothing;
  if not found then
    return false;
  end if;

  -- Keep each person's current plan (a yearly subscriber stays yearly; +7 days either way).
  foreach plan_for in array array[uid::text, inviter::text] loop
    perform public.activate_subscription(
      plan_for::uuid,
      coalesce((select s.plan_id from public.subscriptions s
                where s.user_id = plan_for::uuid and s.status = 'active' and s.current_period_end > now()
                order by s.current_period_end desc limit 1), 'monthly'),
      null,
      7);
  end loop;
  return true;
end $$;
revoke execute on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- ---------- GDPR export: the new data too ----------
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
    'favorites', coalesce((select jsonb_agg(jsonb_build_object(
        'phrase', ph.slug, 'position', f.position, 'pinned_at', f.updated_at) order by f.position)
      from public.favorites f join public.phrases ph on ph.id = f.phrase_id where not f.deleted and f.user_id = auth.uid()), '[]'::jsonb),
    'favorites_removed', coalesce((select jsonb_agg(jsonb_build_object(
        'phrase', ph.slug, 'removed_at', f.updated_at) order by f.updated_at)
      from public.favorites f join public.phrases ph on ph.id = f.phrase_id where f.deleted and f.user_id = auth.uid()), '[]'::jsonb),
    'progress', coalesce((select jsonb_agg(jsonb_build_object(
        'lesson', l.slug, 'course', u.course, 'best_score', u.score, 'attempts', u.attempts, 'completed_at', u.completed_at))
      from public.user_progress u left join public.lessons l on l.id = u.lesson_id where u.user_id = auth.uid()), '[]'::jsonb),
    'word_stats', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id') from public.user_item_stats s where s.user_id = auth.uid()), '[]'::jsonb),
    'streak', (select to_jsonb(x) - 'user_id' from public.user_learning x where x.user_id = auth.uid()),
    'own_phrases', coalesce((select jsonb_agg(jsonb_build_object(
        'tr', c.tr, 'sq', c.sq, 'deleted', c.deleted, 'updated_at', c.updated_at) order by c.updated_at)
      from public.custom_phrases c where c.user_id = auth.uid()), '[]'::jsonb),
    'reminders', coalesce((select jsonb_agg(jsonb_build_object(
        'remind_at', s.remind_at, 'time_zone', s.time_zone, 'enabled', s.enabled, 'created_at', s.created_at))
      from public.push_subscriptions s where s.user_id = auth.uid()), '[]'::jsonb),
    'referral_code', (select c.code from public.referral_codes c where c.user_id = auth.uid()),
    'invited_by_someone', exists (select 1 from public.referrals r where r.referred_id = auth.uid()),
    'friends_invited', (select count(*) from public.referrals r where r.referrer_id = auth.uid()),
    'corrections', coalesce((select jsonb_agg(to_jsonb(c)) from public.corrections c where c.user_id = auth.uid()), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from public.consents c where c.user_id = auth.uid()), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'plan_id', s.plan_id, 'status', s.status, 'current_period_end', s.current_period_end,
        'cancel_at_period_end', s.cancel_at_period_end, 'created_at', s.created_at, 'updated_at', s.updated_at))
      from public.subscriptions s where s.user_id = auth.uid()), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'plan_id', p.plan_id, 'amount', p.amount, 'currency', p.currency,
        'status', p.status, 'created_at', p.created_at)) from public.payments p), '[]'::jsonb),  -- RLS: own rows (user_id isn't readable)
    'usage', coalesce((select jsonb_agg(to_jsonb(u) - 'user_id') from public.usage_counters u where u.user_id = auth.uid()), '[]'::jsonb)
  )
$$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- New tables: same privilege rules as the rest (no TRUNCATE / TRIGGER / REFERENCES for API roles).
revoke truncate, trigger, references on public.push_subscriptions, public.custom_phrases,
  public.referral_codes, public.referrals from anon, authenticated;
