// Content shapes used by the whole app (server and browser). The data itself comes from the
// database (src/lib/content/queries.ts); src/content/*.ts is only the starter import.

import type { Bilingual, Category, Phrase, Reply } from "@/content/quick-talk";
import type { SlangEntry } from "@/content/slang";
import type { Item, Lesson, Track, Unit } from "@/content/lessons";

export type { Bilingual, Category, Item, Lesson, Phrase, Reply, SlangEntry, Track, Unit };

export type QuickTalkContent = { categories: Category[]; replies: Record<string, Reply> };
export type Sources = Record<string, { label: string; url?: string }>;
export type LessonRef = { track: Track; unit: Unit; lesson: Lesson; index: number };

/** Every lesson in learning order with its track and unit, plus lookups by slug and item id. */
export function indexLessons(tracks: Track[]) {
  const lessonList: LessonRef[] = tracks
    .flatMap((track) => track.units.flatMap((unit) => unit.lessons.map((lesson) => ({ track, unit, lesson }))))
    .map((ref, index) => ({ ...ref, index }));
  const lessonBySlug: Record<string, LessonRef> = Object.fromEntries(lessonList.map((ref) => [ref.lesson.slug, ref]));
  const itemById: Record<string, Item> = Object.fromEntries(
    lessonList.flatMap(({ lesson }) => lesson.items.map((item) => [item.id, item])),
  );
  return { lessonList, lessonBySlug, itemById };
}

export function indexPhrases(categories: Category[]) {
  return Object.fromEntries(
    categories.flatMap((category) => category.phrases.map((phrase) => [phrase.id, { phrase, category }])),
  ) as Record<string, { phrase: Phrase; category: Category }>;
}

/** Database slugs ↔ app ids. */
export const slugs = {
  phrase: (id: string) => `qt-${id}`,
  phraseId: (slug: string) => slug.replace(/^qt-/, ""),
  reply: (id: string) => `reply-${id}`,
  replyId: (slug: string) => slug.replace(/^reply-/, ""),
  word: (slug: string) => `slang-${slug}`,
  wordSlug: (slug: string) => slug.replace(/^slang-/, ""),
};

/** Quick Talk fill-in: `{slot}` in a phrase becomes the chosen option (or "…" when none is chosen). */
export function fillSlot(text: string, option?: string): string {
  return option === undefined ? text.replace("{slot}", "…") : text.replace("{slot}", option);
}
