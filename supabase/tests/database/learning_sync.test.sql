-- Learn progress sync tables: RLS, export and account deletion. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'learner-a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'learner-b@test.local');

select ok((select count(*) from lessons where slug = 'greetings') = 1, 'seed: lessons have slugs');

-- ---------- User B has some progress ----------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$ insert into user_item_stats (user_id, item_id, correct, wrong, interval_days, due_at, last_seen)
  values ('00000000-0000-0000-0000-0000000000b1', 'jo', 1, 1, 1, now(), now()) $$, 'user can save their own word stats');
select lives_ok($$ insert into user_learning (user_id, streak_current, streak_longest, streak_last_day)
  values ('00000000-0000-0000-0000-0000000000b1', 3, 5, current_date) $$, 'user can save their own streak');
select lives_ok($$ insert into user_progress (user_id, lesson_id, score, attempts, completed_at)
  select '00000000-0000-0000-0000-0000000000b1', id, 93, 1, now() from lessons where slug = 'greetings' $$,
  'user can save their own lesson result');
select lives_ok($$ insert into user_item_stats (user_id, item_id, correct, wrong, interval_days, due_at, last_seen)
  values ('00000000-0000-0000-0000-0000000000b1', 'jo', 2, 1, 2, now(), now())
  on conflict (user_id, item_id) do update set correct = excluded.correct $$, 'upsert of own row works');
reset role;

-- ---------- User A cannot see or touch it ----------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from user_item_stats), 0, 'user A cannot read user B word stats');
select is((select count(*)::int from user_learning), 0, 'user A cannot read user B streak');
select is((select count(*)::int from user_progress), 0, 'user A cannot read user B lesson results');
select throws_ok($$ insert into user_item_stats (user_id, item_id, correct, wrong, interval_days, due_at, last_seen)
  values ('00000000-0000-0000-0000-0000000000b1', 'po', 9, 0, 1, now(), now()) $$, '42501', null, 'user A cannot write user B word stats');
reset role;

-- ---------- Export and deletion ----------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is((export_my_data() -> 'progress' -> 0 ->> 'lesson'), 'greetings', 'export includes lesson results by slug');
select is((export_my_data() -> 'streak' ->> 'streak_current'), '3', 'export includes the streak');
select delete_my_account();
reset role;
select is((select count(*)::int from user_item_stats where user_id = '00000000-0000-0000-0000-0000000000b1'), 0, 'account deletion removes word stats');
select is((select count(*)::int from user_learning where user_id = '00000000-0000-0000-0000-0000000000b1'), 0, 'account deletion removes the streak');

select * from finish();
rollback;
