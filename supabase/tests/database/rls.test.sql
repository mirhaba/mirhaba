-- RLS and privilege tests. Run with: npm run db:test  (supabase test db)
-- Everything runs in a transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(42);

-- ---------- Helpers: act as a user / as anon ----------
create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

-- ---------- Fixtures (as postgres) ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local', '{"ui_lang":"sq"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'mod@test.local', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'admin@test.local', '{}');
update profiles set role = 'moderator' where id = '00000000-0000-0000-0000-00000000000c';
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000d';

insert into favorites (user_id, phrase_id, position)
  select '00000000-0000-0000-0000-00000000000b', id, 0 from phrases where slug = 'qt-d1';
insert into consents (user_id, type, version, granted)
  values ('00000000-0000-0000-0000-00000000000b', 'terms', '2026-11', true);
insert into subscriptions (id, user_id, plan_id, status, current_period_end) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b', 'monthly', 'active', now() + interval '20 days');
insert into payments (user_id, subscription_id, plan_id, amount, status, raiaccept_order_id, raw_webhook)
  values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000f1', 'monthly', 5.99, 'succeeded', 'ORDER-1', '{"secret":"x"}');

-- ---------- Schema-wide guarantees ----------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'RLS is enabled on every public table');

select is((select count(*)::int from phrase_categories), 11, 'seed: 11 Quick Talk categories');
select is((select count(*)::int from phrases), 72, 'seed: 72 Quick Talk phrases');
select is((select count(*)::int from plans where active), 2, 'seed: monthly + yearly plans');
select is((select price_eur from plans where id = 'yearly'), 57.50::numeric, 'yearly plan is €57.50');

select is(normalize_text('Qyshë'), 'qyshe', 'normalize: ë folds to e');
select is(normalize_text('KAPI kapı'), 'kapi kapi', 'normalize: Turkish I and ı fold to i');
select is(normalize_text('İstanbul  Çka'), 'istanbul cka', 'normalize: İ, Ç and spaces');
select is((select text_normalized from variants where text = 'Çka duhet të bëj?'), 'cka duhet te bej?', 'variants.text_normalized is generated');

select is((select ui_lang::text from profiles where id = '00000000-0000-0000-0000-00000000000a'), 'sq', 'signup trigger creates profile with ui_lang from metadata');
select is((select role::text from profiles where id = '00000000-0000-0000-0000-00000000000a'), 'user', 'new profiles get role user');

-- ---------- Anonymous visitor ----------
select pg_temp.act_as_anon();
select ok((select count(*) from phrases) = 72, 'anon can read Quick Talk phrases');
select ok((select count(*) from plans) = 2, 'anon can read plans');
select is((select count(*)::int from profiles), 0, 'anon sees no profiles');
select throws_ok($$ insert into phrases (slug, category_id, expression_id) select 'x', category_id, expression_id from phrases limit 1 $$, '42501', null, 'anon cannot write content');
select throws_ok($$ select * from favorites $$, '42501', null, 'anon has no access to favorites');
select throws_ok($$ select * from translation_cache $$, '42501', null, 'anon has no access to translation_cache');
reset role;

-- ---------- User A cannot see or touch user B ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from profiles), 1, 'user sees only their own profile');
select is((select count(*)::int from favorites), 0, 'user A cannot read user B favorites');
select is((select count(*)::int from consents), 0, 'user A cannot read user B consents');
select is((select count(*)::int from subscriptions), 0, 'user A cannot read user B subscription');
select is((select count(*)::int from payments), 0, 'user A cannot read user B payments');
select ok(not has_active_subscription(), 'user A is not subscribed');
select ok(not has_active_subscription('00000000-0000-0000-0000-00000000000b'), 'user A cannot probe user B subscription');

select throws_ok(
  $$ insert into favorites (user_id, phrase_id, position) select '00000000-0000-0000-0000-00000000000b', id, 1 from phrases where slug = 'qt-d2' $$,
  '42501', null, 'user A cannot add favourites for user B');
select lives_ok(
  $$ insert into favorites (user_id, phrase_id, position) select '00000000-0000-0000-0000-00000000000a', id, 0 from phrases where slug = 'qt-d2' $$,
  'user A can add their own favourite');

update profiles set ui_lang = 'tr' where id = '00000000-0000-0000-0000-00000000000b';
select throws_ok($$ update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a' $$, '42501', null, 'user cannot make themselves admin');
select lives_ok($$ update profiles set ui_lang = 'tr' where id = '00000000-0000-0000-0000-00000000000a' $$, 'user can change their UI language');

select throws_ok($$ insert into subscriptions (user_id, plan_id, status) values ('00000000-0000-0000-0000-00000000000a', 'yearly', 'active') $$, '42501', null, 'user cannot grant themselves a subscription');
select throws_ok($$ insert into usage_counters (user_id) values ('00000000-0000-0000-0000-00000000000a') $$, '42501', null, 'user cannot reset their own usage counters');
select throws_ok($$ select * from translation_cache $$, '42501', null, 'users have no access to translation_cache');

select lives_ok(
  $$ insert into corrections (user_id, free_text, suggestion) values ('00000000-0000-0000-0000-00000000000a', 'lali', 'lali = shok (Prishtina)') $$,
  'user can submit a correction');
select throws_ok(
  $$ insert into corrections (user_id, free_text, suggestion, status) values ('00000000-0000-0000-0000-00000000000a', 'x', 'y', 'approved') $$,
  '42501', null, 'user cannot submit a pre-approved correction');
update corrections set status = 'approved'; -- silently matches nothing: not a moderator
reset role;
select is((select count(*)::int from corrections where status = 'approved' and user_id = '00000000-0000-0000-0000-00000000000a'), 0, 'user cannot approve corrections');

-- ---------- User B: own data, column-limited payments ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is((select count(*)::int from favorites), 1, 'user B sees their own favourite');
select ok(has_active_subscription(), 'user B has an active subscription');
select throws_ok($$ select raw_webhook from payments $$, '42501', null, 'raw webhook bodies are hidden from users');
select is(export_my_data() -> 'favorites' -> 0 ->> 'phrase', 'qt-d1', 'export_my_data returns own data');
reset role;

-- ---------- Moderator and admin ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
update corrections set status = 'approved', reviewed_by = '00000000-0000-0000-0000-00000000000c', reviewed_at = now()
  where user_id = '00000000-0000-0000-0000-00000000000a';
select is((select count(*)::int from audit_log), 0, 'moderator cannot read the audit log');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from audit_log where action = 'correction.approved' and actor = '00000000-0000-0000-0000-00000000000c'), 1, 'approval was written to the audit log; admin can read it');
reset role;

-- ---------- Delete my account ----------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select delete_my_account();
reset role;
select is((select count(*)::int from profiles where id = '00000000-0000-0000-0000-00000000000b'), 0, 'delete_my_account removes the profile and its rows');
select is((select count(*)::int from payments where raiaccept_order_id = 'ORDER-1' and user_id is null), 1, 'payment record is kept for tax, unlinked from the user');

select * from finish();
rollback;
