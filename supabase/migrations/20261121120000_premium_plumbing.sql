-- Premium plumbing: one function that turns Premium on, or extends it.
-- The RaiAccept webhook will call it (as service_role) after a verified payment. Until payments
-- exist, it is also how Premium is granted by hand in the SQL editor (testing, free accounts):
--   select activate_subscription('<user id>', 'monthly');            -- one billing period
--   select activate_subscription('<user id>', 'yearly', null, 30);   -- 30 days, no payment
--
-- Rules:
-- - One subscription row per user is reused: an active, past-due or pending row (the one with
--   `ref` if given) is updated, otherwise a new row is created.
-- - Renewing before the period ends adds time to the end of the current period, so paying early
--   never loses days. After it lapsed, the new period starts now.
-- - Every activation is written to audit_log.

create or replace function public.activate_subscription(
  uid uuid,
  plan text,
  ref text default null,
  days int default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_interval public.billing_interval;
  sub_id uuid;
  period_end timestamptz;
  new_end timestamptz;
begin
  if days is not null and (days < 1 or days > 3660) then
    raise exception 'days must be between 1 and 3660' using errcode = '22023';
  end if;

  select p.interval into plan_interval from public.plans p where p.id = plan;
  if not found then
    raise exception 'unknown plan %', plan using errcode = '22023';
  end if;

  -- Two webhooks for the same user (retries) must not both extend from the same end date.
  perform pg_advisory_xact_lock(hashtextextended('subscription:' || uid::text, 0));

  select s.id, s.current_period_end into sub_id, period_end
  from public.subscriptions s
  where s.user_id = uid
    and (
      (ref is not null and s.provider_ref = ref)
      or (s.status in ('active', 'past_due', 'pending'))
    )
  order by (ref is not null and s.provider_ref = ref) desc, s.current_period_end desc nulls last
  limit 1;

  new_end := greatest(now(), coalesce(period_end, now()))
    + case
        when days is not null then make_interval(days => days)
        when plan_interval = 'month' then interval '1 month'
        else interval '1 year'
      end;

  if sub_id is null then
    insert into public.subscriptions (user_id, plan_id, status, current_period_end, provider_ref)
    values (uid, plan, 'active', new_end, ref)
    returning id into sub_id;
  else
    update public.subscriptions s
    set plan_id = plan,
        status = 'active',
        current_period_end = new_end,
        cancel_at_period_end = false,
        provider_ref = coalesce(ref, s.provider_ref)
    where s.id = sub_id;
  end if;

  insert into public.audit_log (actor, action, target, details)
  values ((select auth.uid()), 'subscription.activate', uid::text,
          jsonb_build_object('subscription', sub_id, 'plan', plan, 'days', days, 'until', new_end));

  return new_end;
end;
$$;

-- Server only: users must never be able to grant themselves Premium.
revoke execute on function public.activate_subscription(uuid, text, text, int) from public, anon, authenticated;
grant execute on function public.activate_subscription(uuid, text, text, int) to service_role;
