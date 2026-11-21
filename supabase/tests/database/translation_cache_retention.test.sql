-- Translation cache retention (privacy policy: 30 days). Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(5);

insert into translation_cache (hash, source_lang, target_dialect, output, created_at)
values ('old-row', 'tr', 'standard', '{}', now() - interval '31 days'),
       ('new-row', 'tr', 'standard', '{}', now() - interval '29 days');

select is(purge_expired_translation_cache(), 1, 'removes exactly the rows older than 30 days');
select ok(not exists (select 1 from translation_cache where hash = 'old-row'), 'the 31-day-old row is gone');
select ok(exists (select 1 from translation_cache where hash = 'new-row'), 'the 29-day-old row is kept');
select ok(not has_function_privilege('authenticated', 'public.purge_expired_translation_cache()', 'execute'), 'signed-in users cannot call it');
select ok(exists (select 1 from cron.job where jobname = 'purge-translation-cache'), 'the nightly job is scheduled');

select * from finish();
rollback;
