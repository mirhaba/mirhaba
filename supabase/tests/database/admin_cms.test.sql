-- Admin dashboard / CMS: write helpers are server-only, public reads stay public, fixed
-- translations match loosely. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'cms@test.local');
insert into phrase_categories (slug, name_tr, name_sq, icon) values ('cms-test', 'Test', 'Test', 'hand');
insert into courses (slug, title_tr, title_sq) values ('cms-course', 'C', 'C');
insert into units (course_id, slug, title_tr, title_sq) select id, 'cms-unit', 'U', 'U' from courses where slug = 'cms-course';
insert into lessons (unit_id, slug, title_tr, title_sq) select id, 'cms-lesson', 'L', 'L' from units where slug = 'cms-unit';

-- ---------- Users can't call the admin helpers or read admin data ----------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select throws_ok($$ select admin_upsert_expression('x', 'reply', 'a', 'b') $$, '42501', null, 'users cannot upsert expressions');
select throws_ok($$ select admin_save_phrase('qt-x', 'cms-test', 'a', 'b', null, '{}', null, 0) $$, '42501', null, 'users cannot save phrases');
select throws_ok($$ select admin_save_lesson_items('cms-lesson', '[]') $$, '42501', null, 'users cannot save lesson items');
select throws_ok($$ select admin_overview() $$, '42501', null, 'users cannot read admin numbers');
select throws_ok($$ select * from admin_find_users('') $$, '42501', null, 'users cannot search accounts');
select throws_ok($$ select * from find_fixed_translation('tr-sq', 'kosovan', 'x') $$, '42501', null, 'users cannot query fixed translations directly');
select throws_ok($$ select * from fixed_translations $$, '42501', null, 'fixed translations are server-only');
select throws_ok($$ insert into ui_texts (locale, key, value) values ('tr', 'nav.quickTalk', 'x') $$, '42501', null, 'users cannot change UI text');
select lives_ok($$ select key, value from ui_texts $$, 'UI text overrides are publicly readable');
select lives_ok($$ select id, sq, tr from lesson_items $$, 'lesson items are publicly readable');
reset role;

-- ---------- Phrase helper: texts, slots, replies ----------
select admin_upsert_expression('reply-cms-yes', 'reply', 'Evet', 'Po');
select admin_save_phrase('qt-cms1', 'cms-test', 'Kat {slot}', 'Kati {slot}', '[{"tr":"1","sq":"1"}]', array['reply-cms-yes'], '/audio/x.mp3', 3);
select is(
  (select v.text from phrases p join variants v on v.expression_id = p.expression_id and v.lang = 'sq' where p.slug = 'qt-cms1'),
  'Kati {slot}', 'phrase saved with its Albanian text');
select is((select count(*)::int from reply_buttons rb join phrases p on p.id = rb.phrase_id where p.slug = 'qt-cms1'), 1, 'reply button attached');
select is(
  (select v.audio_path from phrases p join variants v on v.expression_id = p.expression_id and v.lang = 'sq' where p.slug = 'qt-cms1'),
  '/audio/x.mp3', 'audio path saved');

-- ---------- Lesson items: replace keeps ids and removes dropped words ----------
select admin_save_lesson_items('cms-lesson', '[{"id":"cms-a","sq":"a","tr":"a"},{"id":"cms-b","sq":"b","tr":"b"}]');
select admin_save_lesson_items('cms-lesson', '[{"id":"cms-b","sq":"bb","tr":"bb"}]');
select is((select string_agg(id || '=' || sq, ',') from lesson_items where lesson_id = (select id from lessons where slug = 'cms-lesson')),
  'cms-b=bb', 'items replaced: kept id updated, removed id gone');

-- ---------- Fixed translations: case, accents, spacing and final punctuation don't matter ----------
insert into fixed_translations (direction, variant, source_text, translation) values ('tr-sq', 'kosovan', 'Kapıdayım, iner misin?', 'Jam te dera');
select is((select translation from find_fixed_translation('tr-sq', 'kosovan', '  KAPIDAYIM,   iner misin ')), 'Jam te dera', 'loose match finds the fixed translation');
select is((select count(*)::int from find_fixed_translation('tr-sq', 'standard', 'Kapıdayım, iner misin?')), 0, 'a different Albanian style does not match');

select * from finish();
rollback;
