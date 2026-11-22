// Two courses from the same lessons: "sq" = Albanian for Turkish speakers (the original), "tr" =
// Turkish for Albanian speakers. The Turkish course mirrors every item, so the lesson engine and
// player stay the same: inside the player, `item.sq` always means "the language being learned"
// and `item.tr` "the language the learner speaks". Progress is kept apart with a "tr:" prefix on
// item ids and lesson slugs (the account stores lesson results per course).

import type { Item, Track } from "@/lib/content/model";
import type { Direction } from "@/lib/preferences-schema";

export type Course = "sq" | "tr";

export const TURKISH_PREFIX = "tr:";

export function courseOf(direction: Direction): Course {
  return direction === "sq-tr" ? "tr" : "sq";
}

/** Tracks that only make sense for learning Albanian (Kosovan slang) are left out of the Turkish course. */
const ALBANIAN_ONLY_TRACKS = new Set(["kosovo-speech"]);

export function tracksFor(tracks: Track[], course: Course): Track[] {
  return course === "sq" ? tracks : tracks.filter((t) => !ALBANIAN_ONLY_TRACKS.has(t.slug));
}

/** The item as the player should see it in this course. Notes explain Albanian words, so the Turkish course drops them. */
export function itemFor(item: Item, course: Course): Item {
  if (course === "sq") return item;
  return { id: `${TURKISH_PREFIX}${item.id}`, sq: item.tr, tr: item.sq };
}

/** Lesson slug used for progress on this device (and mapped back to slug + course when syncing). */
export function progressSlug(slug: string, course: Course): string {
  return course === "sq" ? slug : `${TURKISH_PREFIX}${slug}`;
}

export function splitProgressSlug(key: string): { slug: string; course: Course } {
  return key.startsWith(TURKISH_PREFIX) ? { slug: key.slice(TURKISH_PREFIX.length), course: "tr" } : { slug: key, course: "sq" };
}

/** Letters a keyboard of the other language may lack, offered as buttons when typing. */
export const EXTRA_LETTERS: Record<Course, string[]> = {
  sq: ["ë", "ç"],
  tr: ["ç", "ğ", "ı", "ö", "ş", "ü"],
};
