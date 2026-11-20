-- Sync Quick Talk favourites (max 6 pinned phrases) between the phone and the account.
--
-- Each favourite is a row per (user, phrase) with `updated_at` and a `deleted` flag
-- (a tombstone), so an unpin on one phone also removes the pin on the others instead of
-- being brought back by the next merge. Rule per phrase: the newer change wins; at the same
-- time an unpin wins. Then at most 6 stay pinned (the most recently pinned ones); the rest
-- become tombstones. Order = pin order (oldest first), stored as position 0-5.
-- The same rules live in src/lib/favorites/merge.ts (the phone applies them to the reply).

-- ---------- Table changes ----------
alter table public.favorites
  add column updated_at timestamptz not null default now(),
  add column deleted boolean not null default false,
  alter column position drop not null;

alter table public.favorites drop constraint favorites_position_check;
alter table public.favorites
  add constraint favorites_position_check check (position is null or position between 0 and 5),
  add constraint favorites_removed_has_no_position check (not deleted or position is null);

comment on column public.favorites.updated_at is 'When this phrase was last pinned or unpinned (the phone''s clock, never in the future).';
comment on column public.favorites.deleted is 'Tombstone: the phrase was unpinned. Kept so the unpin syncs to the other phones.';
comment on column public.favorites.position is 'Pin order 0-5 for pinned rows; null for removed rows.';

-- ---------- Never more than 6 pinned, every pinned row has a position ----------
-- Checked at commit, so the sync function can rewrite the list in several statements.
create or replace function public.favorites_check_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
begin
  if (select count(*) from public.favorites f where f.user_id = uid and not f.deleted) > 6 then
    raise exception 'favorites: at most 6 pinned phrases' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.favorites f where f.user_id = uid and not f.deleted and f.position is null) then
    raise exception 'favorites: pinned phrase without a position' using errcode = 'check_violation';
  end if;
  return null;
end $$;

create constraint trigger favorites_limit
  after insert or update on public.favorites
  deferrable initially deferred
  for each row execute function public.favorites_check_limit();

-- ---------- Sync ----------
-- p_items: [{ "slug": "qt-d1", "deleted": false, "updated_at": 1763640000000 }, ...] (ms since epoch).
-- Merges them into the caller's rows and returns the caller's full list in the same shape.
-- Unknown slugs are ignored (they stay on the phone only). Runs with the caller's RLS.
create or replace function public.sync_favorites(p_items jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'sync_favorites: expected an array of at most 500 items' using errcode = '22023';
  end if;

  -- Two phones syncing at the same moment take turns.
  perform pg_advisory_xact_lock(hashtextextended('favorites:' || uid::text, 0));

  -- 1. Per phrase: the newer change wins; same time → the unpin wins. A clock in the future counts as now.
  insert into public.favorites as f (user_id, phrase_id, deleted, updated_at, position)
  -- Integer milliseconds both ways, so a timestamp round-trips exactly (no float rounding).
  select uid, p.id, i.deleted,
    least(timestamptz 'epoch' + i.updated_at * interval '1 millisecond', date_trunc('milliseconds', now())), null
  from jsonb_to_recordset(p_items) as i (slug text, deleted boolean, updated_at bigint)
  join public.phrases p on p.slug = i.slug
  where i.deleted is not null and i.updated_at >= 0
  on conflict (user_id, phrase_id) do update
    set deleted = excluded.deleted, updated_at = excluded.updated_at, position = null
    where (excluded.updated_at, excluded.deleted) > (f.updated_at, f.deleted);

  -- 2. Keep the 6 most recently pinned (ties: the larger slug); older pins become tombstones with
  --    the same time, so the trim is stable. Byte order (collate "C") matches the phone's sort.
  update public.favorites f
  set deleted = true, position = null
  from (
    select x.phrase_id, row_number() over (order by x.updated_at desc, p.slug collate "C" desc) as newest
    from public.favorites x join public.phrases p on p.id = x.phrase_id
    where x.user_id = uid and not x.deleted
  ) r
  where f.user_id = uid and f.phrase_id = r.phrase_id and r.newest > 6;

  -- 3. Positions follow pin order (oldest first).
  update public.favorites f
  set position = r.pos
  from (
    select x.phrase_id, (row_number() over (order by x.updated_at, p.slug collate "C") - 1)::smallint as pos
    from public.favorites x join public.phrases p on p.id = x.phrase_id
    where x.user_id = uid and not x.deleted
  ) r
  where f.user_id = uid and f.phrase_id = r.phrase_id and f.position is distinct from r.pos;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'slug', p.slug,
        'deleted', f.deleted,
        'updated_at', floor(extract(epoch from f.updated_at) * 1000)::bigint) -- numeric: exact
      order by p.slug)
    from public.favorites f join public.phrases p on p.id = f.phrase_id
    where f.user_id = uid
  ), '[]'::jsonb);
end $$;

revoke execute on function public.sync_favorites(jsonb) from public, anon;
grant execute on function public.sync_favorites(jsonb) to authenticated;
revoke execute on function public.favorites_check_limit() from public, anon, authenticated;

-- ---------- GDPR export: favourites by phrase, plus removed ones ----------
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
      from public.favorites f join public.phrases ph on ph.id = f.phrase_id where not f.deleted), '[]'::jsonb),
    'favorites_removed', coalesce((select jsonb_agg(jsonb_build_object(
        'phrase', ph.slug, 'removed_at', f.updated_at) order by f.updated_at)
      from public.favorites f join public.phrases ph on ph.id = f.phrase_id where f.deleted), '[]'::jsonb),
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
