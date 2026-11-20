-- Free-tier counting and the AI spend cap. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'quota@test.local');

-- ---------- Quota: 3 per day ----------
select is(consume_text_translation('00000000-0000-0000-0000-0000000000e1', 3), 2, 'first translation: 2 left');
select is(consume_text_translation('00000000-0000-0000-0000-0000000000e1', 3), 1, 'second: 1 left');
select is(consume_text_translation('00000000-0000-0000-0000-0000000000e1', 3), 0, 'third: 0 left');
select is(consume_text_translation('00000000-0000-0000-0000-0000000000e1', 3), -1, 'fourth is refused');
select is((select text_translations from usage_counters where user_id = '00000000-0000-0000-0000-0000000000e1'), 3, 'counter never goes past the limit');

select refund_text_translation('00000000-0000-0000-0000-0000000000e1');
select is(consume_text_translation('00000000-0000-0000-0000-0000000000e1', 3), 0, 'a refund gives one back');

-- ---------- Spend cap ----------
-- Start from a clean ledger (the whole test is rolled back).
delete from ai_spend_daily;
select ok(ai_budget_available(5), 'budget available on a fresh day');
select record_ai_spend(1000, 200, 3.5);
select record_ai_spend(1000, 200, 1.6);
select is((select requests from ai_spend_daily), 2, 'spend rows accumulate');
select ok(not ai_budget_available(5), 'cap reached at €5.10 of €5');

-- ---------- Nobody but the server may call these ----------
set local role authenticated;
select throws_ok($$ select consume_text_translation('00000000-0000-0000-0000-0000000000e1', 999) $$, '42501', null, 'users cannot count their own usage');
select throws_ok($$ select record_ai_spend(1, 1, 0) $$, '42501', null, 'users cannot touch the spend ledger');
select throws_ok($$ select * from ai_spend_daily $$, '42501', null, 'users cannot read the spend ledger');
reset role;

select * from finish();
rollback;
