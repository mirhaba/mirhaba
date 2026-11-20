-- Mirhaba foundation: extensions, enums, shared helpers.
-- Every later migration builds on these. Never edit an applied migration; add a new one.

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------- Enums ----------
create type public.lang as enum ('tr', 'sq');
create type public.dialect as enum ('standard', 'gheg', 'prishtina', 'turkish_slang');
create type public.register as enum ('neutral', 'casual', 'vulgar');
create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.correction_status as enum ('pending', 'approved', 'rejected');
create type public.billing_interval as enum ('month', 'year');
create type public.subscription_status as enum ('pending', 'active', 'past_due', 'canceled', 'expired');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.exercise_type as enum ('choose', 'match', 'listen', 'speak', 'order', 'type');

-- ---------- Text normalisation ----------
-- Same rules as src/lib/text.ts normalizeForSearch(): lower-case, fold Turkish and
-- Albanian diacritics, so "qysh" finds "qyshë" and "kapi" finds "kapı".
-- IMMUTABLE so it can back generated columns and indexes.
create or replace function public.normalize_text(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
    lower(translate(input,
      'İIıËëÇçŞşĞğÖöÜüÂâÎîÛûÉé',
      'iiieeccssggoouuaaiiuuee')),
    '\s+', ' ', 'g'))
$$;

-- ---------- updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
