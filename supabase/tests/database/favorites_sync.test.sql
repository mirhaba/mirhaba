-- Quick Talk favourites sync: RLS, merge rules (tombstones), max 6, export, deletion. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Pinned slugs of the current user, in position order.
create function pg_temp.pinned() returns text language sql as $$
  select coalesce(string_agg(p.slug, ' ' order by f.position), '')
  from public.favorites f join public.phrases p on p.id = f.phrase_id where not f.deleted
$$;

-- One sync item: slug, deleted, updated_at in ms.
create function pg_temp.item(slug text, deleted boolean, ms bigint) returns jsonb language sql as $$
  select jsonb_build_object('slug', slug, 'deleted', deleted, 'updated_at', ms)
$$;

grant execute on function pg_temp.pinned() to authenticated;
grant execute on function pg_temp.item(text, boolean, bigint) to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'fav-a@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'fav-b@test.local');

select ok((select count(*) from phrases where slug in ('qt-d1', 'qt-d2', 'qt-b1')) = 3, 'seed: Quick Talk phrases have qt- slugs');

-- ---------- Phone 1 of user B pins three phrases ----------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is(
  jsonb_array_length(sync_favorites(jsonb_build_array(
    pg_temp.item('qt-d2', false, 2000), pg_temp.item('qt-d1', false, 1000), pg_temp.item('qt-b1', false, 3000)))),
  3, 'sync returns the account''s list');
select is(pg_temp.pinned(), 'qt-d1 qt-d2 qt-b1', 'positions follow pin order (oldest first)');

-- ---------- Phone 2 (new phone, empty) gets the same list ----------
select is(
  (select string_agg(x ->> 'slug', ' ' order by x ->> 'slug') from jsonb_array_elements(sync_favorites('[]'::jsonb)) x),
  'qt-b1 qt-d1 qt-d2', 'a new phone receives the pins');

-- ---------- Removals sync (tombstones) ----------
select lives_ok($$ select sync_favorites(jsonb_build_array(pg_temp.item('qt-d2', true, 4000))) $$, 'unpin syncs');
select is(pg_temp.pinned(), 'qt-d1 qt-b1', 'unpinned phrase is gone and positions close the gap');
select is((select position from favorites f join phrases p on p.id = f.phrase_id where p.slug = 'qt-d2'), null,
  'removed row keeps a tombstone without a position');
select lives_ok($$ select sync_favorites(jsonb_build_array(pg_temp.item('qt-d2', false, 2000))) $$, 'stale phone sends its old pin');
select is(pg_temp.pinned(), 'qt-d1 qt-b1', 'an older pin does not bring a removed favourite back');
select lives_ok($$ select sync_favorites(jsonb_build_array(pg_temp.item('qt-b1', true, 3000))) $$, 'unpin at the same time as the pin');
select is(pg_temp.pinned(), 'qt-d1', 'same time: the unpin wins');
select lives_ok($$ select sync_favorites(jsonb_build_array(pg_temp.item('qt-d2', false, 5000))) $$, 'pin again later');
select is(pg_temp.pinned(), 'qt-d1 qt-d2', 'a newer pin restores it');

-- ---------- Never more than 6 ----------
select lives_ok($$ select sync_favorites(jsonb_build_array(
  pg_temp.item('qt-b2', false, 6000), pg_temp.item('qt-b3', false, 7000), pg_temp.item('qt-b4', false, 8000),
  pg_temp.item('qt-b5', false, 9000), pg_temp.item('qt-d3', false, 10000), pg_temp.item('qt-not-a-phrase', false, 11000))) $$,
  'merge with 7 pins and an unknown phrase');
select is(pg_temp.pinned(), 'qt-d2 qt-b2 qt-b3 qt-b4 qt-b5 qt-d3', 'keeps the 6 most recent pins; unknown phrase ignored');
select lives_ok($$ set constraints all immediate $$, 'commit-time checks pass after sync');
set constraints all deferred;
set constraints all immediate;
select throws_ok($$ insert into favorites (user_id, phrase_id, position)
  select '00000000-0000-0000-0000-0000000000b2', id, null from phrases where slug = 'qt-d4' $$,
  '23514', null, 'a 7th pinned row is refused by the table itself');
set constraints all deferred;

-- ---------- Clock in the future counts as now ----------
select lives_ok($$ select sync_favorites(jsonb_build_array(pg_temp.item('qt-d1', false, 32503680000000))) $$, 'pin from a phone clock in year 3000');
select ok((select updated_at <= now() from favorites f join phrases p on p.id = f.phrase_id where p.slug = 'qt-d1'),
  'future timestamps are clamped to now');
select throws_ok($$ select sync_favorites('{"slug":"qt-d1"}'::jsonb) $$, '22023', null, 'non-array input is refused');
reset role;

-- ---------- Other users ----------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from favorites), 0, 'user A cannot read user B favourites');
select is(jsonb_array_length(sync_favorites('[]'::jsonb)), 0, 'user A''s sync only sees their own list');
reset role;
set role anon;
select throws_ok($$ select sync_favorites('[]'::jsonb) $$, '42501', null, 'signed-out callers cannot sync');
reset role;

-- ---------- Export and deletion ----------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is(pg_temp.pinned(), 'qt-b2 qt-b3 qt-b4 qt-b5 qt-d3 qt-d1', 'the newest pin pushed out the oldest');
select is((export_my_data() -> 'favorites' -> 0 ->> 'phrase'), 'qt-b2', 'export lists favourites by phrase, in order');
select is((select string_agg(x ->> 'phrase', ' ' order by x ->> 'phrase') from jsonb_array_elements(export_my_data() -> 'favorites_removed') x),
  'qt-b1 qt-d2', 'export lists removed favourites too');
select delete_my_account();
reset role;
select is((select count(*)::int from favorites where user_id = '00000000-0000-0000-0000-0000000000b2'), 0, 'account deletion removes favourites');

select * from finish();
rollback;
