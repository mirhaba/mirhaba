-- Engagement features: preferences, lesson results per course, reminders, own phrases, referrals.
-- Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(34);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

insert into auth.users (id, email, created_at) values
  ('00000000-0000-0000-0000-0000000000e1', 'inviter@test.local', now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000000e2', 'friend@test.local', now()),
  ('00000000-0000-0000-0000-0000000000e3', 'old-account@test.local', now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000000e4', 'stranger@test.local', now());

-- ---------- Preferences ----------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select lives_ok($$ update profiles set preferences = '{"theme":"dark","dailyGoal":3}', preferences_updated_at = now()
  where id = '00000000-0000-0000-0000-0000000000e1' $$, 'user can save their preferences');
select throws_ok($$ update profiles set preferences = '[1,2]' where id = '00000000-0000-0000-0000-0000000000e1' $$,
  '23514', null, 'preferences must be an object');
select throws_ok($$ update profiles set preferences = jsonb_build_object('x', repeat('a', 5000)) where id = '00000000-0000-0000-0000-0000000000e1' $$,
  '23514', null, 'preferences are size-limited');
select throws_ok($$ update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000e1' $$,
  '42501', null, 'still no way to change the role');
reset role;

-- ---------- Lesson results per course ----------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select lives_ok($$ insert into user_progress (user_id, lesson_id, course, score, attempts)
  select '00000000-0000-0000-0000-0000000000e1', id, 'sq', 80, 1 from lessons where slug = 'greetings' $$,
  'Albanian course result saved');
select lives_ok($$ insert into user_progress (user_id, lesson_id, course, score, attempts)
  select '00000000-0000-0000-0000-0000000000e1', id, 'tr', 60, 1 from lessons where slug = 'greetings' $$,
  'Turkish course result for the same lesson is a separate row');
select throws_ok($$ insert into user_progress (user_id, lesson_id, course, score, attempts)
  select '00000000-0000-0000-0000-0000000000e1', id, 'de', 60, 1 from lessons where slug = 'numbers' $$,
  '23514', null, 'only sq and tr courses');
select is((select jsonb_array_length(export_my_data() -> 'progress')), 2, 'export lists both course results');
reset role;

-- ---------- Reminders ----------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select lives_ok($$ insert into push_subscriptions (user_id, endpoint, p256dh, auth, remind_at, time_zone)
  values ('00000000-0000-0000-0000-0000000000e1', 'https://push.example/e1', 'k', 'a', 0, 'Europe/Belgrade') $$,
  'user can turn reminders on');
select throws_ok($$ update push_subscriptions set last_sent_on = current_date $$,
  '42501', null, 'user cannot touch the sender bookkeeping');
select throws_ok($$ insert into push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0000-0000000000e4', 'https://push.example/x', 'k', 'a') $$,
  '42501', null, 'user cannot add reminders for someone else');
select lives_ok($$ update push_subscriptions set time_zone = 'Not/AZone' $$, 'an unknown time zone is accepted…');
select is((select time_zone from push_subscriptions where endpoint = 'https://push.example/e1'), 'Europe/Belgrade', '…but replaced by the default');
select throws_ok($$ select * from due_reminders() $$, '42501', null, 'users cannot list due reminders');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e4');
select is((select count(*)::int from push_subscriptions), 0, 'reminders are private');
reset role;

-- Sender (service_role): remind_at 0 is always past, no lesson today → due once.
set local role service_role;
select is((select count(*)::int from due_reminders() where endpoint = 'https://push.example/e1'), 1, 'reminder is due');
select is((select course from due_reminders() where endpoint = 'https://push.example/e1'), 'sq', 'course defaults to Albanian');
select lives_ok($$ select mark_reminders_sent(
  (select jsonb_agg(jsonb_build_object('id', id, 'local_day', local_day)) from due_reminders()), '{}') $$, 'sender marks them sent');
select is((select count(*)::int from due_reminders() where endpoint = 'https://push.example/e1'), 0, 'not due again the same day');
reset role;

-- A lesson done today: no reminder needed.
update push_subscriptions set last_sent_on = null;
insert into user_learning (user_id, streak_current, streak_longest, streak_last_day)
values ('00000000-0000-0000-0000-0000000000e1', 4, 4, (now() at time zone 'Europe/Belgrade')::date);
set local role service_role;
select is((select count(*)::int from due_reminders() where endpoint = 'https://push.example/e1'), 0, 'no reminder after today''s lesson');
reset role;
update user_learning set streak_last_day = (now() at time zone 'Europe/Belgrade')::date - 1;
set local role service_role;
select ok((select streak_at_risk from due_reminders() where endpoint = 'https://push.example/e1'), 'yesterday''s streak is at risk tonight');
reset role;

-- ---------- Own phrases ----------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select lives_ok($$ insert into custom_phrases (user_id, id, tr, sq, updated_at)
  select '00000000-0000-0000-0000-0000000000e1', gen_random_uuid(), 'cümle ' || i, 'fjali ' || i, now() from generate_series(1, 50) i $$,
  '50 own phrases are fine');
-- The limit is checked at commit; this test never commits, so check right away.
set constraints custom_phrases_limit immediate;
select throws_ok($$ insert into custom_phrases (user_id, id, tr, sq, updated_at)
  values ('00000000-0000-0000-0000-0000000000e1', gen_random_uuid(), 'bir tane daha', 'edhe një', now()) $$,
  '23514', null, 'the 51st is refused');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e4');
select is((select count(*)::int from custom_phrases), 0, 'own phrases are private');
reset role;

-- ---------- Referrals ----------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select matches(my_referral_code(), '^[A-Z2-9]{8}$', 'invite code is 8 readable characters');
select is(my_referral_code(), (select code from referral_codes where user_id = '00000000-0000-0000-0000-0000000000e1'), 'the same code every time');
select is(claim_referral(my_referral_code()), false, 'own code gives nothing');
select throws_ok($$ insert into referrals (referred_id, referrer_id) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e4') $$,
  '42501', null, 'users cannot write referrals directly');
reset role;

-- The friend only knows the code from the link (they can't read others' codes).
create function pg_temp.remember_code(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('test.code', (select code from referral_codes where user_id = uid), true);
end $$;
select pg_temp.remember_code('00000000-0000-0000-0000-0000000000e1');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select is((select count(*)::int from referral_codes), 0, 'other people''s invite codes are private');
select is(claim_referral(current_setting('test.code')), true, 'a new account redeems an invite');
select is(claim_referral(current_setting('test.code')), false, 'only once');
select is(claim_referral('NOTACODE'), false, 'unknown codes give nothing');
reset role;
select is((select count(*)::int from subscriptions
  where user_id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2')
    and status = 'active' and current_period_end > now() + interval '6 days'), 2, 'both got 7 days of Premium');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e3');
select is(claim_referral(current_setting('test.code')), false, 'accounts older than 7 days cannot redeem');
reset role;

select * from finish();
rollback;
