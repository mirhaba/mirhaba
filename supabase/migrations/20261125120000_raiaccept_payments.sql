-- RaiAccept card payments (Raiffeisen Bank Kosovo).
--
-- Flow: the server creates a `payments` row (amount taken from `plans`, never from the browser),
-- creates the RaiAccept order + payment session and sends the buyer to the RaiAccept payment page.
-- RaiAccept's webhooks are NOT signed, so nothing here trusts them: the server asks RaiAccept for the
-- order (with its own API credentials) and passes the verified result to `settle_payment`, which:
--   - locks the payment row, so concurrent webhooks / return-page loads are applied one at a time,
--   - grants Premium exactly once per payment (activate_subscription), and is safe to call any number of times,
--   - never moves a payment backwards (a late "FAILED" can't undo a success).
-- Premium is prepaid: RaiAccept has no merchant-initiated recurring charges, so nothing renews by itself.

-- ---------- payments: what we need to verify and reconcile ----------
alter table public.payments
  add column reference text unique
    check (reference ~ '^[A-Za-z0-9_-]{1,150}$'),             -- our merchantOrderReference (unique per attempt)
  add column raiaccept_status text,                            -- last verified RaiAccept order status (PAID, FAILED, …)
  add column raiaccept_transaction_id text,                    -- the successful PURCHASE transaction (needed for refunds)
  add column status_code text check (status_code ~ '^[0-9]{4}$'), -- RaiAccept 4-digit result code
  add column is_production boolean,                            -- false = Sandbox (test cards), never real money
  add column paid_at timestamptz,
  add column refunded_amount numeric(10, 2) not null default 0 check (refunded_amount >= 0),
  add column refund_requested_at timestamptz,                  -- set atomically before calling the refund API (no double refunds)
  add column premium_revoked_at timestamptz,
  add column checked_at timestamptz;                           -- last time the status was verified with RaiAccept

create index payments_pending_idx on public.payments (created_at) where status = 'pending';

comment on column public.payments.reference is 'merchantOrderReference sent to RaiAccept; one per checkout attempt.';
comment on column public.payments.raw_webhook is 'Unused: webhooks are only a trigger to re-verify with the RaiAccept API.';

-- ---------- Start a checkout: the price always comes from `plans` ----------
create or replace function public.create_payment(p_user uuid, p_plan text, p_reference text)
returns table (id uuid, amount numeric, currency char(3))
language plpgsql
security definer
set search_path = ''
as $$
declare
  price numeric(8, 2);
begin
  select p.price_eur into price from public.plans p where p.id = p_plan and p.active;
  if price is null then
    raise exception 'unknown plan %', p_plan using errcode = '22023';
  end if;
  return query
    insert into public.payments as pay (user_id, plan_id, amount, currency, status, reference)
    values (p_user, p_plan, price, 'EUR', 'pending', p_reference)
    returning pay.id, pay.amount, pay.currency;
end;
$$;

-- ---------- Apply a VERIFIED RaiAccept order status ----------
-- p_order_status: the order status from GET /orders/{id} (DRAFT, CHECKOUT, PAID, PARTIALLY_REFUNDED,
-- FULLY_REFUNDED, FAILED, CANCELED, ABANDONED). Amount/currency must match what we charged.
create or replace function public.settle_payment(
  p_payment uuid,
  p_order_id text,
  p_order_status text,
  p_amount numeric,
  p_currency text,
  p_is_production boolean,
  p_transaction_id text default null,
  p_status_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments%rowtype;
  new_end timestamptz;
  activated boolean := false;
begin
  -- One settlement at a time per payment (webhook retries and the return page can race).
  select * into pay from public.payments where id = p_payment for update;
  if not found then
    raise exception 'unknown payment' using errcode = '22023';
  end if;
  if pay.raiaccept_order_id is distinct from p_order_id then
    raise exception 'order does not belong to this payment' using errcode = '22023';
  end if;
  if round(p_amount, 2) <> pay.amount or upper(p_currency) <> pay.currency then
    raise exception 'amount mismatch: expected % %, got % %', pay.amount, pay.currency, p_amount, p_currency
      using errcode = '22023';
  end if;

  update public.payments set
    raiaccept_status = p_order_status,
    is_production = p_is_production,
    raiaccept_transaction_id = coalesce(p_transaction_id, raiaccept_transaction_id),
    status_code = coalesce(case when p_status_code ~ '^[0-9]{4}$' then p_status_code end, status_code),
    checked_at = now()
  where id = p_payment;

  if p_order_status = 'PAID' then
    -- A failed attempt may be retried inside the same payment session and then succeed.
    if pay.status in ('pending', 'failed') then
      if pay.user_id is null then
        -- The account was deleted before the payment was confirmed: keep the money record, nothing to activate.
        update public.payments set status = 'succeeded', paid_at = now() where id = p_payment;
      else
        new_end := public.activate_subscription(pay.user_id, pay.plan_id, p_order_id, null);
        update public.payments p set status = 'succeeded', paid_at = now(),
          subscription_id = (select s.id from public.subscriptions s where s.provider_ref = p_order_id)
        where p.id = p_payment;
        activated := true;
      end if;
      insert into public.audit_log (actor, action, target, details)
      values (null, 'payment.succeeded', p_payment::text,
              jsonb_build_object('order', p_order_id, 'amount', pay.amount, 'plan', pay.plan_id,
                                 'production', p_is_production, 'until', new_end));
    end if;
  elsif p_order_status in ('PARTIALLY_REFUNDED', 'FULLY_REFUNDED') then
    if pay.status <> 'refunded' and p_order_status = 'FULLY_REFUNDED' then
      update public.payments set status = 'refunded', refunded_amount = amount,
        paid_at = coalesce(paid_at, now()) where id = p_payment;
      insert into public.audit_log (actor, action, target, details)
      values (null, 'payment.refunded', p_payment::text, jsonb_build_object('order', p_order_id, 'amount', pay.amount));
    end if;
  elsif p_order_status in ('FAILED', 'CANCELED', 'ABANDONED') then
    -- Never undo a success: only a still-pending payment becomes failed.
    if pay.status = 'pending' then
      update public.payments set status = 'failed' where id = p_payment;
    end if;
  end if;
  -- DRAFT / CHECKOUT: still in progress, nothing to change.

  select * into pay from public.payments where id = p_payment;
  return jsonb_build_object('status', pay.status, 'activated', activated, 'premium_until', new_end);
end;
$$;

-- ---------- Refunds (admin): claim once, then take back the period that was bought ----------
-- Returns false when a refund was already requested for this payment (double clicks, two admins).
create or replace function public.claim_refund(p_payment uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.payments set refund_requested_at = now()
    where id = p_payment and status = 'succeeded' and refund_requested_at is null
    returning 1
  )
  select exists (select 1 from claimed)
$$;

-- Lets a refund be retried after the RaiAccept call failed.
create or replace function public.release_refund_claim(p_payment uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payments set refund_requested_at = null where id = p_payment and status = 'succeeded'
$$;

-- Removes the time this payment added to the subscription (not more), once.
create or replace function public.revoke_payment_period(p_payment uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments%rowtype;
  plan_interval public.billing_interval;
  sub public.subscriptions%rowtype;
  new_end timestamptz;
begin
  select * into pay from public.payments where id = p_payment for update;
  if not found or pay.subscription_id is null or pay.premium_revoked_at is not null then
    return null;
  end if;
  select p.interval into plan_interval from public.plans p where p.id = pay.plan_id;
  select * into sub from public.subscriptions where id = pay.subscription_id for update;
  if not found then return null; end if;

  new_end := sub.current_period_end - case when plan_interval = 'month' then interval '1 month' else interval '1 year' end;
  update public.subscriptions
  set current_period_end = greatest(new_end, now()),
      status = case when new_end <= now() then 'canceled'::public.subscription_status else status end
  where id = sub.id;
  update public.payments set premium_revoked_at = now() where id = p_payment;
  insert into public.audit_log (actor, action, target, details)
  values (null, 'payment.premium_revoked', p_payment::text, jsonb_build_object('subscription', sub.id, 'until', greatest(new_end, now())));
  return greatest(new_end, now());
end;
$$;

-- Server only (service role). Users can never create, settle or refund payments themselves.
revoke execute on function public.create_payment(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.settle_payment(uuid, text, text, numeric, text, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.claim_refund(uuid) from public, anon, authenticated;
revoke execute on function public.release_refund_claim(uuid) from public, anon, authenticated;
revoke execute on function public.revoke_payment_period(uuid) from public, anon, authenticated;
grant execute on function public.create_payment(uuid, text, text) to service_role;
grant execute on function public.settle_payment(uuid, text, text, numeric, text, boolean, text, text) to service_role;
grant execute on function public.claim_refund(uuid) to service_role;
grant execute on function public.release_refund_claim(uuid) to service_role;
grant execute on function public.revoke_payment_period(uuid) to service_role;

-- ---------- Admin → Payments list (service role only) ----------
create or replace function public.admin_list_payments(p_status text default null, p_limit int default 100)
returns table (
  id uuid, user_id uuid, email text, plan_id text, amount numeric, currency char(3), status text,
  raiaccept_status text, status_code text, raiaccept_order_id text, reference text, is_production boolean,
  created_at timestamptz, paid_at timestamptz, refund_requested_at timestamptz, premium_revoked_at timestamptz, checked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.user_id, u.email::text, p.plan_id, p.amount, p.currency, p.status::text,
         p.raiaccept_status, p.status_code, p.raiaccept_order_id, p.reference, p.is_production,
         p.created_at, p.paid_at, p.refund_requested_at, p.premium_revoked_at, p.checked_at
  from public.payments p
  left join auth.users u on u.id = p.user_id
  where p_status is null or p.status::text = p_status
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 500)
$$;
revoke execute on function public.admin_list_payments(text, int) from public, anon, authenticated;
grant execute on function public.admin_list_payments(text, int) to service_role;
