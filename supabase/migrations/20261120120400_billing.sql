-- Plans, subscriptions and payments (RaiAccept).
-- Users can read their own subscription/payments. Only the server (service_role),
-- after a verified webhook or API status check, ever writes these tables.

create table public.plans (
  id text primary key,                       -- 'monthly' | 'yearly'
  name_tr text not null,
  name_sq text not null,
  price_eur numeric(8, 2) not null check (price_eur > 0),  -- VAT included
  interval public.billing_interval not null,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order int not null default 0
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status public.subscription_status not null default 'pending',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provider_ref text unique,                  -- RaiAccept recurring token / order reference
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_id_idx on public.subscriptions (user_id, status);
create index subscriptions_plan_id_idx on public.subscriptions (plan_id);
create index subscriptions_period_end_idx on public.subscriptions (current_period_end) where status = 'active';

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Payments are kept after account deletion only as long as tax law requires,
-- so the user link is nulled instead of cascading.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  plan_id text references public.plans (id),
  amount numeric(10, 2) not null check (amount >= 0),
  currency char(3) not null default 'EUR',
  status public.payment_status not null default 'pending',
  raiaccept_order_id text unique,            -- idempotency key for webhooks
  raw_webhook jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_id_idx on public.payments (user_id, created_at desc);
create index payments_subscription_id_idx on public.payments (subscription_id);
create index payments_plan_id_idx on public.payments (plan_id);

create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

create policy "plans: public read active" on public.plans
  for select to anon, authenticated
  using (active);

create policy "subscriptions: read own" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "payments: read own" on public.payments
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete, truncate on public.plans, public.subscriptions, public.payments from anon, authenticated;
revoke select on public.subscriptions, public.payments from anon;
-- The raw webhook body is for the server only.
revoke select on public.payments from authenticated;
grant select (id, subscription_id, plan_id, amount, currency, status, created_at) on public.payments to authenticated;

-- Is this user paid right now? Used by server code and later by RLS on premium content.
create or replace function public.has_active_subscription(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and s.status = 'active'
      and s.current_period_end > now()
  )
  and (uid = (select auth.uid()) or (select auth.role()) = 'service_role')
$$;
revoke execute on function public.has_active_subscription(uuid) from public, anon;
grant execute on function public.has_active_subscription(uuid) to authenticated, service_role;
