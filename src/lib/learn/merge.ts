// Merging Learn progress from two places (this phone + the account). Pure and symmetric:
// merge(a, b) equals merge(b, a), and merging the result again changes nothing, so
// syncing twice, or from several phones, is always safe.

import { z } from "zod";

export const lessonSnapSchema = z.object({
  slug: z.string().min(1).max(80),
  bestScore: z.number().int().min(0).max(100),
  attempts: z.number().int().min(0).max(100_000),
  completedAt: z.number().int().min(0),
});

export const itemSnapSchema = z.object({
  itemId: z.string().min(1).max(80),
  correct: z.number().int().min(0).max(1_000_000),
  wrong: z.number().int().min(0).max(1_000_000),
  intervalDays: z.number().int().min(1).max(365),
  dueAt: z.number().int().min(0),
  lastSeen: z.number().int().min(0),
  wrongSession: z.string().max(200).optional(),
});

export const streakSnapSchema = z.object({
  current: z.number().int().min(0).max(100_000),
  longest: z.number().int().min(0).max(100_000),
  lastDay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export const snapshotSchema = z.object({
  lessons: z.array(lessonSnapSchema).max(1000),
  items: z.array(itemSnapSchema).max(10_000),
  streak: streakSnapSchema,
});

export type LessonSnap = z.infer<typeof lessonSnapSchema>;
export type ItemSnap = z.infer<typeof itemSnapSchema>;
export type StreakSnap = z.infer<typeof streakSnapSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;

export const emptySnapshot = (): Snapshot => ({ lessons: [], items: [], streak: { current: 0, longest: 0, lastDay: null } });

function mergeBy<T>(a: T[], b: T[], key: (x: T) => string, pick: (x: T, y: T) => T): T[] {
  const out = new Map<string, T>();
  for (const row of [...a, ...b]) {
    const k = key(row);
    const prev = out.get(k);
    out.set(k, prev ? pick(prev, row) : row);
  }
  return [...out.values()].sort((x, y) => key(x).localeCompare(key(y)));
}

/** Lessons: best score wins; attempts = the higher count (not a sum, so re-syncing never inflates it). */
function mergeLesson(x: LessonSnap, y: LessonSnap): LessonSnap {
  return {
    slug: x.slug,
    bestScore: Math.max(x.bestScore, y.bestScore),
    attempts: Math.max(x.attempts, y.attempts),
    completedAt: Math.max(x.completedAt, y.completedAt),
  };
}

/** Words: the most recently practised state wins (ties: the one with more answers). */
function mergeItem(x: ItemSnap, y: ItemSnap): ItemSnap {
  if (x.lastSeen !== y.lastSeen) return x.lastSeen > y.lastSeen ? x : y;
  return x.correct + x.wrong >= y.correct + y.wrong ? x : y;
}

/** Streak: the one that reached the later day wins; same day → the longer run; longest = max. */
function mergeStreak(x: StreakSnap, y: StreakSnap): StreakSnap {
  const longest = Math.max(x.longest, y.longest);
  if (x.lastDay === y.lastDay) return { current: Math.max(x.current, y.current), longest, lastDay: x.lastDay };
  const later = !x.lastDay ? y : !y.lastDay ? x : x.lastDay > y.lastDay ? x : y;
  return { current: later.current, longest, lastDay: later.lastDay };
}

export function mergeSnapshots(a: Snapshot, b: Snapshot): Snapshot {
  return {
    lessons: mergeBy(a.lessons, b.lessons, (l) => l.slug, mergeLesson),
    items: mergeBy(a.items, b.items, (i) => i.itemId, mergeItem),
    streak: mergeStreak(a.streak, b.streak),
  };
}
