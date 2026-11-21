// "Import starter content": copies src/content/*.ts into the database.
// Safe to run any number of times: it only ADDS what's missing and fills fields that are still
// empty (e.g. lessons created by an older seed without items). It never overwrites an edit
// made in the admin dashboard.
//
// Used by Admin → Import and by `npm run db:import`. No "server-only" import, so the script can
// run it in plain Node; it always receives a service-role client.

import type { SupabaseClient } from "@supabase/supabase-js";
import { categories, replies } from "../../content/quick-talk.ts";
import { slang } from "../../content/slang.ts";
import { sources } from "../../content/sources.ts";
import { tracks } from "../../content/lessons.ts";
import { slugs } from "./model.ts";

export type ImportReport = Record<"sources" | "replies" | "categories" | "phrases" | "words" | "tracks" | "units" | "lessons" | "lessonItems", number>;

async function check<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

export async function importStarterContent(db: SupabaseClient): Promise<ImportReport> {
  const report: ImportReport = { sources: 0, replies: 0, categories: 0, phrases: 0, words: 0, tracks: 0, units: 0, lessons: 0, lessonItems: 0 };

  // ---- Sources
  const haveSources = new Set((await check(db.from("content_sources").select("id"))).map((r: { id: string }) => r.id));
  const newSources = Object.entries(sources)
    .map(([id, s], i) => ({ id, label: s.label, url: s.url ?? null, sort_order: i }))
    .filter((s) => !haveSources.has(s.id));
  if (newSources.length) await check(db.from("content_sources").insert(newSources));
  report.sources = newSources.length;

  // ---- Reply buttons and Quick Talk
  const expressions = await check(db.from("expressions").select("slug, term"));
  const haveExpr = new Map((expressions as { slug: string; term: string | null }[]).map((e) => [e.slug, e]));
  for (const reply of Object.values(replies)) {
    if (haveExpr.has(slugs.reply(reply.id))) continue;
    await check(db.rpc("admin_upsert_expression", { p_slug: slugs.reply(reply.id), p_category: "reply", p_tr: reply.tr, p_sq: reply.sq }));
    report.replies++;
  }

  const haveCats = new Set((await check(db.from("phrase_categories").select("slug"))).map((r: { slug: string }) => r.slug));
  const havePhrases = new Set((await check(db.from("phrases").select("slug"))).map((r: { slug: string }) => r.slug));
  for (const [ci, category] of categories.entries()) {
    if (!haveCats.has(category.slug)) {
      await check(
        db.from("phrase_categories").insert({
          slug: category.slug,
          name_tr: category.name.tr,
          name_sq: category.name.sq,
          icon: category.icon,
          sort_order: ci,
          basic_pack: category.basic,
        }),
      );
      report.categories++;
    }
    for (const [pi, phrase] of category.phrases.entries()) {
      if (havePhrases.has(slugs.phrase(phrase.id))) continue;
      await check(
        db.rpc("admin_save_phrase", {
          p_slug: slugs.phrase(phrase.id),
          p_category_slug: category.slug,
          p_tr: phrase.tr,
          p_sq: phrase.sq,
          p_slots: phrase.slot ?? null,
          p_reply_slugs: (phrase.replies ?? []).map(slugs.reply),
          p_audio: phrase.audio ?? null,
          p_sort_order: pi,
        }),
      );
      report.phrases++;
    }
  }

  // ---- Dictionary
  for (const [i, entry] of slang.entries()) {
    const slug = slugs.word(entry.slug);
    const existing = haveExpr.get(slug);
    if (existing?.term) continue; // already imported with all fields (or edited): leave it alone
    if (!existing) {
      await check(
        db.rpc("admin_upsert_expression", {
          p_slug: slug,
          p_category: `slang:${entry.kind}`,
          p_tr: entry.tr,
          p_sq: entry.sqStandard,
          p_sq_kosovo: entry.sqKosovo ?? null,
          p_tr_dialect: entry.kind === "turkish_slang" ? "turkish_slang" : "standard",
        }),
      );
    }
    await check(
      db
        .from("expressions")
        .update({
          register: entry.register,
          notes_tr: entry.meaning.tr,
          notes_sq: entry.meaning.sq,
          term: entry.term.text,
          term_lang: entry.term.lang,
          origin: entry.origin ?? null,
          example_tr: entry.example?.tr ?? null,
          example_sq: entry.example?.sq ?? null,
          sources: entry.sources,
          verified: entry.verified,
          sort_order: i,
        })
        .eq("slug", slug),
    );
    report.words++;
  }

  // ---- Lessons
  const courses = (await check(db.from("courses").select("id, slug, description_tr"))) as { id: string; slug: string; description_tr: string }[];
  const units = (await check(db.from("units").select("id, slug"))) as { id: string; slug: string }[];
  const lessons = (await check(db.from("lessons").select("id, slug, situation_sq, lesson_items(id)"))) as {
    id: string;
    slug: string;
    situation_sq: string;
    lesson_items: { id: string }[];
  }[];
  const courseBySlug = new Map(courses.map((c) => [c.slug, c]));
  const unitBySlug = new Map(units.map((u) => [u.slug, u]));
  const lessonBySlug = new Map(lessons.map((l) => [l.slug, l]));

  for (const [ti, track] of tracks.entries()) {
    let course = courseBySlug.get(track.slug);
    const trackFields = { description_tr: track.description.tr, description_sq: track.description.sq, icon: track.icon };
    if (!course) {
      const [row] = await check(
        db
          .from("courses")
          .insert({ slug: track.slug, title_tr: track.title.tr, title_sq: track.title.sq, sort_order: ti, is_free: true, ...trackFields })
          .select("id, slug, description_tr"),
      );
      course = row;
      report.tracks++;
    } else if (!course.description_tr) {
      await check(db.from("courses").update(trackFields).eq("id", course.id));
    }

    for (const [ui, unit] of track.units.entries()) {
      let unitRow = unitBySlug.get(unit.slug);
      if (!unitRow) {
        const [row] = await check(
          db
            .from("units")
            .insert({ course_id: course!.id, slug: unit.slug, title_tr: unit.title.tr, title_sq: unit.title.sq, sort_order: ui, is_free: unit.isFree })
            .select("id, slug"),
        );
        unitRow = row;
        report.units++;
      }
      for (const [li, lesson] of unit.lessons.entries()) {
        const existing = lessonBySlug.get(lesson.slug);
        if (!existing) {
          await check(
            db.from("lessons").insert({
              unit_id: unitRow!.id,
              slug: lesson.slug,
              title_tr: lesson.title.tr,
              title_sq: lesson.title.sq,
              situation: lesson.situation.tr,
              situation_sq: lesson.situation.sq,
              sort_order: li,
            }),
          );
          report.lessons++;
        } else if (!existing.situation_sq) {
          await check(db.from("lessons").update({ situation_sq: lesson.situation.sq }).eq("id", existing.id));
        }
        if (!existing || existing.lesson_items.length === 0) {
          await check(
            db.rpc("admin_save_lesson_items", {
              p_lesson_slug: lesson.slug,
              p_items: lesson.items.map((item) => ({ id: item.id, sq: item.sq, tr: item.tr, note_tr: item.note?.tr ?? "", note_sq: item.note?.sq ?? "" })),
            }),
          );
          report.lessonItems += lesson.items.length;
        }
      }
    }
  }

  return report;
}
