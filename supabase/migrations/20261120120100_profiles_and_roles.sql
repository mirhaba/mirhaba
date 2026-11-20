-- Profiles (one per auth user) and role helpers used by every RLS policy.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  ui_lang public.lang not null default 'tr',
  role public.user_role not null default 'user',
  marketing_opt_in boolean not null default false,
  age_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Users read their own profile. Moderators/admins are checked by the helpers below.
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Column-level protection: a user may only change these columns, never `role`.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (ui_lang, marketing_opt_in, age_confirmed_at) on public.profiles to authenticated;

-- Create the profile automatically when someone signs up.
-- ui_lang comes from the sign-up metadata the app sends ({ "ui_lang": "tr" | "sq" }).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, ui_lang)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'ui_lang' = 'sq' then 'sq'::public.lang else 'tr'::public.lang end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helpers. SECURITY DEFINER so policies can call them without recursive RLS.
-- The role always comes from the database, never from the browser or JWT claims.
create or replace function public.current_role_is(wanted public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = any (wanted)
  )
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
set search_path = ''
as $$ select public.current_role_is(array['moderator', 'admin']::public.user_role[]) $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$ select public.current_role_is(array['admin']::public.user_role[]) $$;

revoke execute on function public.current_role_is(public.user_role[]) from public, anon;
grant execute on function public.current_role_is(public.user_role[]) to authenticated;
