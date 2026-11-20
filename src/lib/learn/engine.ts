// Builds a short lesson (4–5 minutes) from a lesson's items, and checks answers.
// Deterministic for a given seed, so server and client render the same first exercise.

import type { Item } from "@/content/lessons";
import { normalizeForSearch } from "@/lib/text";

export type Exercise =
  | { kind: "learn"; item: Item }
  /** Pick the meaning. `direction` "sq-tr": Albanian prompt, Turkish options. */
  | { kind: "choose"; item: Item; direction: "sq-tr" | "tr-sq"; options: string[] }
  | { kind: "match"; items: Item[] }
  /** Put the Albanian words in order. */
  | { kind: "order"; item: Item; tiles: string[] }
  /** Type the Albanian for a Turkish prompt. */
  | { kind: "type"; item: Item };

export type GradedKind = Exclude<Exercise["kind"], "learn">;

// ---------- Seeded randomness (mulberry32) ----------
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const words = (s: string) => s.replace(/[.,!?;:…]/g, "").split(/\s+/).filter(Boolean);
const isPhrase = (item: Item) => words(item.sq).length >= 2;

/**
 * 3 wrong options. Same-lesson items first (similar topic = a real choice), then items
 * of the same shape (word vs sentence) from other lessons, so the answer isn't obvious.
 */
function options(item: Item, lessonItems: Item[], extraPool: Item[], field: "sq" | "tr", random: () => number): string[] {
  const usable = (p: Item) => p.id !== item.id && p[field] !== item[field];
  const sameShape = (p: Item) => isPhrase(p) === isPhrase(item);
  const candidates = [
    ...shuffle(lessonItems.filter(usable), random),
    ...shuffle(extraPool.filter((p) => usable(p) && sameShape(p)), random),
  ]
    .map((p) => p[field])
    .filter((v, i, all) => all.indexOf(v) === i && v !== item[field])
    .slice(0, 3);
  return shuffle([item[field], ...candidates], random);
}

/**
 * New lesson: learn cards in groups of three, each followed by a quick check;
 * then a pair-matching round, word order, typing and reverse choice.
 */
export function buildLesson(items: Item[], seed: number, extraPool: Item[] = []): Exercise[] {
  const random = rng(seed);
  const order = shuffle(items, random);
  const out: Exercise[] = [];

  for (let i = 0; i < order.length; i += 3) {
    const group = order.slice(i, i + 3);
    for (const item of group) out.push({ kind: "learn", item });
    for (const item of shuffle(group, random)) {
      out.push({ kind: "choose", item, direction: "sq-tr", options: options(item, items, extraPool, "tr", random) });
    }
  }

  if (items.length >= 4) out.push({ kind: "match", items: shuffle(items, random).slice(0, 4) });

  for (const item of shuffle(items.filter(isPhrase), random).slice(0, 2)) {
    out.push({ kind: "order", item, tiles: shuffle(words(item.sq), random) });
  }

  for (const item of shuffle(items.filter((i) => !isPhrase(i) && i.sq.length <= 14), random).slice(0, 2)) {
    out.push({ kind: "type", item });
  }

  for (const item of shuffle(items, random).slice(0, 2)) {
    out.push({ kind: "choose", item, direction: "tr-sq", options: options(item, items, extraPool, "sq", random) });
  }
  return out;
}

/** Review of weak words: no learn cards, mixed checks. */
export function buildReview(items: Item[], seed: number, extraPool: Item[] = []): Exercise[] {
  const random = rng(seed);
  const out: Exercise[] = shuffle(items, random).map((item, i) => {
    if (i % 3 === 1 && !isPhrase(item) && item.sq.length <= 14) return { kind: "type", item } as const;
    if (i % 3 === 2 && isPhrase(item)) return { kind: "order", item, tiles: shuffle(words(item.sq), random) } as const;
    return {
      kind: "choose",
      item,
      direction: i % 2 ? "tr-sq" : "sq-tr",
      options: options(item, items, extraPool, i % 2 ? "sq" : "tr", random),
    } as const;
  });
  if (items.length >= 4) out.push({ kind: "match", items: shuffle(items, random).slice(0, 4) });
  return out;
}

/** A fresh check for an item answered wrong, asked again at the end of the lesson. */
export function retryOf(exercise: Exercise, lessonItems: Item[], extraPool: Item[], seed: number): Exercise | null {
  const random = rng(seed);
  if (exercise.kind === "choose" || exercise.kind === "type" || exercise.kind === "order") {
    const item = exercise.item;
    return { kind: "choose", item, direction: "sq-tr", options: options(item, lessonItems, extraPool, "tr", random) };
  }
  return null;
}

// ---------- Answer checking ----------

const loose = (s: string) => normalizeForSearch(s.replace(/[.,!?;:…'’]/g, " "));
const strict = (s: string) => s.replace(/[.,!?;:…]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("sq");

export type TypedResult = "exact" | "accents" | "wrong";

/**
 * Typed answers: accents and punctuation don't make an answer wrong (people on Turkish
 * keyboards can't easily type ë), but we say when the spelling should have ë/ç.
 */
export function checkTyped(input: string, expected: string): TypedResult {
  if (strict(input) === strict(expected)) return "exact";
  if (loose(input) === loose(expected)) return "accents";
  return "wrong";
}

export function checkOrder(tiles: string[], expected: string): boolean {
  return strict(tiles.join(" ")) === strict(expected);
}
