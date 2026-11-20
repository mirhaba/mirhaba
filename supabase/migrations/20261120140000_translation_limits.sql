-- Text translation: free-tier counting (atomic) and a global daily AI spending cap.
-- Everything here is called by the server with the service_role key, never by browsers.

-- ---------- Per-user daily quota ----------
-- Atomically counts one translation if the user is still under their daily limit.
-- Returns the number left after this one, or -1 when the limit is already reached.
-- "Day" is the Kosovo calendar day, so the quota resets at local midnight.
create or replace function public.consume_text_translation(uid uuid, daily_limit int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Belgrade')::date;
  used int;
begin
  insert into public.usage_counters as u (user_id, day, text_translations)
  values (uid, today, 1)
  on conflict (user_id, day) do update
    set text_translations = u.text_translations + 1
    where u.text_translations < daily_limit
  returning u.text_translations into used;

  if used is null then
    return -1; -- conflict row existed and was already at the limit: nothing updated
  end if;
  return greatest(daily_limit - used, 0);
end;
$$;

-- Gives a translation back when the AI call failed after counting it.
create or replace function public.refund_text_translation(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.usage_counters
  set text_translations = greatest(text_translations - 1, 0)
  where user_id = uid and day = (now() at time zone 'Europe/Belgrade')::date
$$;

-- ---------- Global AI spend (hard cap) ----------
create table public.ai_spend_daily (
  day date primary key,
  requests int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cost_eur numeric(10, 4) not null default 0
);

alter table public.ai_spend_daily enable row level security;
-- No policies: server only.
revoke all on public.ai_spend_daily from anon, authenticated;

-- Is there budget left today? Checked before every AI call.
create or replace function public.ai_budget_available(cap_eur numeric)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select cost_eur from public.ai_spend_daily where day = (now() at time zone 'UTC')::date), 0) < cap_eur
$$;

-- Records what a finished AI call actually cost.
create or replace function public.record_ai_spend(input_tokens int, output_tokens int, cost_eur numeric)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.ai_spend_daily as s (day, requests, input_tokens, output_tokens, cost_eur)
  values ((now() at time zone 'UTC')::date, 1, input_tokens, output_tokens, cost_eur)
  on conflict (day) do update set
    requests = s.requests + 1,
    input_tokens = s.input_tokens + excluded.input_tokens,
    output_tokens = s.output_tokens + excluded.output_tokens,
    cost_eur = s.cost_eur + excluded.cost_eur
$$;

-- Server-only functions: nobody but service_role may call them.
revoke execute on function public.consume_text_translation(uuid, int) from public, anon, authenticated;
revoke execute on function public.refund_text_translation(uuid) from public, anon, authenticated;
revoke execute on function public.ai_budget_available(numeric) from public, anon, authenticated;
revoke execute on function public.record_ai_spend(int, int, numeric) from public, anon, authenticated;
grant execute on function public.consume_text_translation(uuid, int) to service_role;
grant execute on function public.refund_text_translation(uuid) to service_role;
grant execute on function public.ai_budget_available(numeric) to service_role;
grant execute on function public.record_ai_spend(int, int, numeric) to service_role;

-- ---------- Translation cache housekeeping ----------
-- Outputs are kept 30 days after their last hit. Run daily (Vercel Cron or pg_cron) once live.
create or replace function public.prune_translation_cache()
returns int
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.translation_cache where last_hit_at < now() - interval '30 days' returning 1
  )
  select count(*)::int from deleted
$$;
revoke execute on function public.prune_translation_cache() from public, anon, authenticated;
grant execute on function public.prune_translation_cache() to service_role;
