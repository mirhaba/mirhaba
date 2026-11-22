-- Privilege hardening (security audit, Nov 2026).
--
-- 1. TRUNCATE ignores row level security: with it, one signed-in user could empty a whole table
--    (everyone's favourites or progress), and anon held it on `profiles`. PostgREST never issues
--    TRUNCATE, so this wasn't reachable through the API, but a single future SQL function would
--    make it so. TRIGGER and REFERENCES aren't needed by browsers either. Revoke all three on every
--    table in `public`, now and for tables created later.
-- 2. `subscriptions.provider_ref` is the payment provider's recurring token / order reference: the
--    server needs it, the browser doesn't. Users keep reading every other column of their own rows.
-- 3. Reports ("Wrong translation?") must arrive unreviewed: `reviewed_at` is also forced empty.
-- 4. Supabase's `rls_auto_enable()` event trigger (created from the dashboard) is not meant to be
--    called through the API. EXECUTE isn't checked when an event trigger fires, so this changes nothing else.
-- 5. Covering indexes for two foreign keys (performance advisor).

-- ---------- 1. No TRUNCATE / TRIGGER / REFERENCES for API roles ----------
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t.relname);
  end loop;
end $$;

alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;

-- ---------- 2. subscriptions: every column except provider_ref ----------
revoke select on public.subscriptions from authenticated;
grant select (id, user_id, plan_id, status, current_period_end, cancel_at_period_end, created_at, updated_at)
  on public.subscriptions to authenticated;

-- The export listed `to_jsonb(s)` (all columns); name them instead, without provider_ref.
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
        'lesson', l.slug, 'best_score', u.score, 'attempts', u.attempts, 'completed_at', u.completed_at))
      from public.user_progress u left join public.lessons l on l.id = u.lesson_id where u.user_id = auth.uid()), '[]'::jsonb),
    'word_stats', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id') from public.user_item_stats s where s.user_id = auth.uid()), '[]'::jsonb),
    'streak', (select to_jsonb(x) - 'user_id' from public.user_learning x where x.user_id = auth.uid()),
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

-- ---------- 3. New reports are unreviewed ----------
drop policy "corrections: insert own pending" on public.corrections;
create policy "corrections: insert own pending" on public.corrections
  for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending' and reviewed_by is null and reviewed_at is null);

-- ---------- 4. Dashboard event trigger: not an API endpoint ----------
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
exception when insufficient_privilege then
  raise notice 'rls_auto_enable: not owner, left as is';
end $$;

-- ---------- 5. Foreign-key indexes ----------
create index if not exists fixed_translations_created_by_idx on public.fixed_translations (created_by);
create index if not exists ui_texts_updated_by_idx on public.ui_texts (updated_by);
