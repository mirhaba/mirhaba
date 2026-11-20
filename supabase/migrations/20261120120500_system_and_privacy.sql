-- Server-only tables (translation cache, audit log) and the GDPR self-service functions.

-- ---------- Translation cache (server only; no conversations are stored, only outputs keyed by hash) ----------
create table public.translation_cache (
  hash text primary key,                     -- sha256(source_lang | target_dialect | normalised input)
  source_lang public.lang not null,
  target_dialect public.dialect not null,
  output text not null,
  hits int not null default 1,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz not null default now()
);
create index translation_cache_last_hit_idx on public.translation_cache (last_hit_at);

alter table public.translation_cache enable row level security;
-- No policies on purpose: only service_role (which bypasses RLS) can touch it.
revoke all on public.translation_cache from anon, authenticated;

-- ---------- Audit log for admin/moderator actions ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users (id) on delete set null,
  action text not null,
  target text,
  details jsonb,
  at timestamptz not null default now()
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_actor_idx on public.audit_log (actor);

alter table public.audit_log enable row level security;
create policy "audit_log: admins read" on public.audit_log
  for select to authenticated
  using ((select public.is_admin()));
revoke all on public.audit_log from anon;
revoke insert, update, delete, truncate on public.audit_log from authenticated;

-- Log every correction review automatically.
create or replace function public.log_correction_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_log (actor, action, target, details)
    values ((select auth.uid()), 'correction.' || new.status, new.id::text,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

create trigger corrections_audit after update on public.corrections
  for each row execute function public.log_correction_review();

-- ---------- GDPR: export my data (right of access) ----------
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security invoker   -- runs with the caller's RLS, so it can only ever see their own rows
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'favorites', coalesce((select jsonb_agg(to_jsonb(f)) from public.favorites f), '[]'::jsonb),
    'progress', coalesce((select jsonb_agg(to_jsonb(u)) from public.user_progress u), '[]'::jsonb),
    'corrections', coalesce((select jsonb_agg(to_jsonb(c)) from public.corrections c where c.user_id = auth.uid()), '[]'::jsonb),
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from public.consents c), '[]'::jsonb),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(s)) from public.subscriptions s), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'plan_id', p.plan_id, 'amount', p.amount, 'currency', p.currency,
        'status', p.status, 'created_at', p.created_at)) from public.payments p), '[]'::jsonb),
    'usage', coalesce((select jsonb_agg(to_jsonb(u)) from public.usage_counters u), '[]'::jsonb)
  )
$$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- ---------- GDPR: delete my account ----------
-- Deleting the auth user cascades to profile, progress, favourites, consents and usage;
-- payments keep the money record with user_id nulled (tax law).
-- Called from the server with the user's session; the server then signs them out.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
