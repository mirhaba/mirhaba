-- The privacy policy promises translation results stay in the cache for 30 days.
-- Nothing deleted them; this adds the cleanup and runs it every night with pg_cron.

create extension if not exists pg_cron with schema pg_catalog;

-- Deletes cache rows created more than 30 days ago. Returns how many were removed.
create or replace function public.purge_expired_translation_cache()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.translation_cache where created_at < now() - interval '30 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.purge_expired_translation_cache() from public, anon, authenticated;
grant execute on function public.purge_expired_translation_cache() to service_role;

-- Every night at 03:17 UTC (re-running this migration replaces the job instead of duplicating it).
select cron.unschedule(jobid) from cron.job where jobname = 'purge-translation-cache';
select cron.schedule('purge-translation-cache', '17 3 * * *', 'select public.purge_expired_translation_cache()');
