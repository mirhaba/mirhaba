-- RaiAccept payments: price from plans, idempotent settlement, no double Premium, no going backwards,
-- refunds claimed once, users can't touch any of it. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'buyer@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'other@test.local');

-- ---------- create_payment: price from plans ----------
create temp table t (k text primary key, id uuid);
insert into t select 'p1', id from create_payment('00000000-0000-0000-0000-0000000000c1', 'monthly', 'MH-TEST-1');
select is((select amount from payments where id = (select id from t where k = 'p1')), 5.99::numeric, 'price comes from plans (monthly 5.99)');
select is((select status::text from payments where id = (select id from t where k = 'p1')), 'pending', 'new payment is pending');
select throws_ok($$ select create_payment('00000000-0000-0000-0000-0000000000c1', 'lifetime', 'MH-TEST-X') $$, '22023', null, 'unknown plan is refused');
select throws_ok($$ select create_payment('00000000-0000-0000-0000-0000000000c1', 'monthly', 'bad ref!') $$, '23514', null, 'reference must be RaiAccept-safe');
select throws_ok($$ select create_payment('00000000-0000-0000-0000-0000000000c1', 'monthly', 'MH-TEST-1') $$, '23505', null, 'reference is unique');

update payments set raiaccept_order_id = 'ORD-1' where id = (select id from t where k = 'p1');

-- ---------- settle_payment: verification guards ----------
select throws_ok($$ select settle_payment((select id from t where k = 'p1'), 'ORD-OTHER', 'PAID', 5.99, 'EUR', false) $$,
  '22023', null, 'an order id that is not this payment''s is refused');
select throws_ok($$ select settle_payment((select id from t where k = 'p1'), 'ORD-1', 'PAID', 0.01, 'EUR', false) $$,
  '22023', null, 'a different amount is refused');
select throws_ok($$ select settle_payment((select id from t where k = 'p1'), 'ORD-1', 'PAID', 5.99, 'USD', false) $$,
  '22023', null, 'a different currency is refused');
select is((select count(*)::int from subscriptions where user_id = '00000000-0000-0000-0000-0000000000c1' and status = 'active' and current_period_end > now()), 0, 'no Premium before a verified payment');

-- In progress: nothing changes
select is(settle_payment((select id from t where k = 'p1'), 'ORD-1', 'CHECKOUT', 5.99, 'EUR', false) ->> 'status', 'pending', 'CHECKOUT keeps it pending');

-- ---------- PAID: Premium once ----------
select is(settle_payment((select id from t where k = 'p1'), 'ORD-1', 'PAID', 5.99, 'eur', false, 'TX-1', '0000') ->> 'activated', 'true', 'PAID activates Premium');
select is((select count(*)::int from subscriptions where user_id = '00000000-0000-0000-0000-0000000000c1' and status = 'active' and current_period_end > now() + interval '27 days'), 1, 'buyer is Premium for about a month');
create temp table first_end as select current_period_end from subscriptions where user_id = '00000000-0000-0000-0000-0000000000c1';
select is(settle_payment((select id from t where k = 'p1'), 'ORD-1', 'PAID', 5.99, 'EUR', false) ->> 'activated', 'false', 'a repeated PAID (webhook retry) does not activate again');
select is((select current_period_end from subscriptions where user_id = '00000000-0000-0000-0000-0000000000c1'),
  (select current_period_end from first_end), 'the period was not extended twice');
select is((select count(*)::int from audit_log where action = 'payment.succeeded' and target = (select id::text from t where k = 'p1')), 1, 'one audit entry');
select is((select raiaccept_transaction_id from payments where id = (select id from t where k = 'p1')), 'TX-1', 'transaction id stored for refunds');
select isnt((select subscription_id from payments where id = (select id from t where k = 'p1')), null, 'payment linked to the subscription');

-- A late FAILED can't undo a success
select is(settle_payment((select id from t where k = 'p1'), 'ORD-1', 'FAILED', 5.99, 'EUR', false) ->> 'status', 'succeeded', 'FAILED after PAID keeps succeeded');

-- ---------- Failed then retried in the same session ----------
insert into t select 'p2', id from create_payment('00000000-0000-0000-0000-0000000000c2', 'yearly', 'MH-TEST-2');
update payments set raiaccept_order_id = 'ORD-2' where id = (select id from t where k = 'p2');
select is(settle_payment((select id from t where k = 'p2'), 'ORD-2', 'FAILED', 57.50, 'EUR', false, null, '2004') ->> 'status', 'failed', 'decline → failed');
select is((select status_code from payments where id = (select id from t where k = 'p2')), '2004', 'decline code stored');
select is(settle_payment((select id from t where k = 'p2'), 'ORD-2', 'PAID', 57.50, 'EUR', false) ->> 'status', 'succeeded', 'a later success in the same order still counts');

-- ---------- Refunds ----------
select ok(claim_refund((select id from t where k = 'p1')), 'first refund claim wins');
select ok(not claim_refund((select id from t where k = 'p1')), 'second refund claim is refused (no double refund)');
select isnt(revoke_payment_period((select id from t where k = 'p1')), null, 'the bought period is taken back');
select is(revoke_payment_period((select id from t where k = 'p1')), null, '...only once');
select is(settle_payment((select id from t where k = 'p1'), 'ORD-1', 'FULLY_REFUNDED', 5.99, 'EUR', false) ->> 'status', 'refunded', 'FULLY_REFUNDED → refunded');

-- ---------- Users can't call any of it ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select settle_payment((select id from payments limit 1), 'ORD-1', 'PAID', 5.99, 'EUR', true) $$, '42501', null, 'users cannot settle payments');

select * from finish();
rollback;
