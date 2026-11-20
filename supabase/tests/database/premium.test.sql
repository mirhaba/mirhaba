-- Premium plumbing: activate_subscription. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'p1@test.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'p2@test.local');

-- Users can't call it, not even for themselves.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(
  $$ select activate_subscription('00000000-0000-0000-0000-0000000000e1', 'monthly') $$,
  '42501', null, 'a user cannot grant themselves Premium');
select ok(not has_active_subscription(), 'not Premium before activation');
reset role;

-- First activation: one month from now.
-- (Not BETWEEN: it would evaluate, and so activate, twice.)
select ok(
  abs(extract(epoch from activate_subscription('00000000-0000-0000-0000-0000000000e1', 'monthly') - (now() + interval '1 month'))) < 60,
  'monthly activation lasts one month');
select is((select count(*)::int from subscriptions where user_id = '00000000-0000-0000-0000-0000000000e1'), 1, 'one subscription row');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select ok(has_active_subscription(), 'Premium after activation');
reset role;

-- Renewing early extends from the end of the current period and reuses the row.
select ok(
  activate_subscription('00000000-0000-0000-0000-0000000000e1', 'monthly', 'order-2') > now() + interval '2 months' - interval '1 minute',
  'early renewal adds to the current period');
select is((select count(*)::int from subscriptions where user_id = '00000000-0000-0000-0000-0000000000e1'), 1, 'renewal reuses the row');
select is((select provider_ref from subscriptions where user_id = '00000000-0000-0000-0000-0000000000e1'), 'order-2', 'provider reference saved');

-- A lapsed subscription restarts from now, not from the old end date.
update subscriptions set current_period_end = now() - interval '10 days' where user_id = '00000000-0000-0000-0000-0000000000e1';
select ok(
  activate_subscription('00000000-0000-0000-0000-0000000000e1', 'yearly', null, 30) < now() + interval '31 days',
  'after a lapse the new period starts now (30 free days)');

-- Bad input.
select throws_ok($$ select activate_subscription('00000000-0000-0000-0000-0000000000e2', 'lifetime') $$,
  '22023', null, 'unknown plan is refused');
select throws_ok($$ select activate_subscription('00000000-0000-0000-0000-0000000000e2', 'monthly', null, 0) $$,
  '22023', null, 'zero days is refused');

select is(
  (select count(*)::int from audit_log where action = 'subscription.activate' and target = '00000000-0000-0000-0000-0000000000e1'),
  3, 'every activation is audited');

select * from finish();
rollback;
