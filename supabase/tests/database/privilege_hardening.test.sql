-- Privilege hardening: no TRUNCATE/TRIGGER/REFERENCES for API roles, provider_ref is server-only,
-- the export still works and only contains the caller's rows. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

-- No API role holds TRUNCATE, TRIGGER or REFERENCES on any public table.
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
     and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')),
  0, 'anon/authenticated hold no TRUNCATE, TRIGGER or REFERENCES on public tables');

-- Tables created later don't get them either (default privileges).
create table public.__hardening_probe (id int);
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and table_name = '__hardening_probe' and grantee in ('anon', 'authenticated')
     and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')),
  0, 'new tables: no TRUNCATE, TRIGGER or REFERENCES for API roles');
drop table public.__hardening_probe;

select ok(not has_column_privilege('authenticated', 'public.subscriptions', 'provider_ref', 'select'),
  'users cannot read subscriptions.provider_ref');
select ok(has_column_privilege('authenticated', 'public.subscriptions', 'current_period_end', 'select'),
  'users can still read their subscription end date');

-- Fixtures
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'h1@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'h2@test.local');
insert into subscriptions (user_id, plan_id, status, current_period_end, provider_ref) values
  ('00000000-0000-0000-0000-0000000000a1', 'monthly', 'active', now() + interval '5 days', 'SECRET-REF-1'),
  ('00000000-0000-0000-0000-0000000000a2', 'monthly', 'active', now() + interval '5 days', 'SECRET-REF-2');

-- As user 1
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select lives_ok($$ select export_my_data() $$, 'export works without provider_ref access');
select is(jsonb_array_length(export_my_data() -> 'subscriptions'), 1, 'export lists only my subscription');
select ok(position('SECRET-REF' in export_my_data()::text) = 0, 'export never contains provider_ref');

select throws_ok(
  $$ insert into corrections (user_id, free_text, suggestion, reviewed_at)
     values ('00000000-0000-0000-0000-0000000000a1', 'x', 'y', now()) $$,
  '42501', null, 'a new report cannot arrive already reviewed');
select lives_ok(
  $$ insert into corrections (user_id, free_text, suggestion) values ('00000000-0000-0000-0000-0000000000a1', 'x', 'y') $$,
  'a normal report still works');

select * from finish();
rollback;
