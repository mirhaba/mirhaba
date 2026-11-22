"use client";

// Learn progress on the device: lesson results, daily streak and per-word strength.
// Every function fails soft (private mode / blocked storage): learning still works,
// it just isn't remembered.

import { getDB, type ItemStatRow, type LessonProgressRow } from "@/lib/offline-db";
import { emptySnapshot, mergeSnapshots, type Snapshot } from "./merge";
import { syncLearning } from "./sync-action";

const DAY = 86_400_000;

/** Local calendar day as YYYY-MM-DD (the streak follows the person's own midnight). */
export function localDay(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`)) / DAY);
}

export type Streak = { current: number; longest: number; lastDay: string | null };
const EMPTY_STREAK: Streak = { current: 0, longest: 0, lastDay: null };

/** Current streak as it stands today (a missed day resets it to 0 for display). */
export async function getStreak(): Promise<Streak> {
  try {
    const row = await getDB().meta.get("streak");
    const streak = (row?.value as Streak | undefined) ?? EMPTY_STREAK;
    if (streak.lastDay && daysBetween(streak.lastDay, localDay()) > 1) return { ...streak, current: 0 };
    return streak;
  } catch {
    return EMPTY_STREAK;
  }
}

export type Today = { day: string; sessions: number };

/** Lessons and reviews finished today on this device (for the daily goal on the dashboard). */
export async function getToday(): Promise<Today> {
  const day = localDay();
  try {
    const row = (await getDB().meta.get("today"))?.value as Today | undefined;
    return row?.day === day ? row : { day, sessions: 0 };
  } catch {
    return { day, sessions: 0 };
  }
}

async function bumpToday(): Promise<void> {
  const today = await getToday();
  await getDB().meta.put({ key: "today", value: { day: today.day, sessions: today.sessions + 1 } satisfies Today });
}

/** Called when a lesson or review is finished. Counts each day once. */
async function bumpStreak(): Promise<Streak> {
  const db = getDB();
  const today = localDay();
  const row = await db.meta.get("streak");
  const prev = (row?.value as Streak | undefined) ?? EMPTY_STREAK;
  if (prev.lastDay === today) return prev;
  const continued = prev.lastDay !== null && daysBetween(prev.lastDay, today) === 1;
  const current = continued ? prev.current + 1 : 1;
  const next: Streak = { current, longest: Math.max(prev.longest, current), lastDay: today };
  await db.meta.put({ key: "streak", value: next });
  return next;
}

export async function getLessonProgress(): Promise<Record<string, LessonProgressRow>> {
  try {
    const rows = await getDB().lessonProgress.toArray();
    return Object.fromEntries(rows.map((r) => [r.lessonSlug, r]));
  } catch {
    return {};
  }
}

/**
 * Record one answer. Spaced repetition, kept simple: right → see it again after 1, 2, 4, 8…
 * days; wrong → due now and back to a 1-day interval. A mistake stays up for review until
 * it is answered right in a *later* session (getting the end-of-lesson retry right doesn't count).
 */
export async function recordAnswer(itemId: string, correct: boolean, sessionId: string): Promise<void> {
  try {
    const db = getDB();
    const now = Date.now();
    const prev = await db.itemStats.get(itemId);
    const stillWeak = correct && prev?.wrongSession === sessionId;
    const intervalDays = correct && !stillWeak ? Math.min((prev?.intervalDays ?? 0) * 2 || 1, 60) : 1;
    const row: ItemStatRow = {
      itemId,
      correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
      wrong: (prev?.wrong ?? 0) + (correct ? 0 : 1),
      intervalDays,
      dueAt: correct && !stillWeak ? now + intervalDays * DAY : now,
      lastSeen: now,
      wrongSession: correct ? (stillWeak ? sessionId : undefined) : sessionId,
    };
    await db.itemStats.put(row);
  } catch {
    /* not remembered */
  }
}

/** Lesson (or review, slug "review") finished: keep the best score and bump the streak. */
export async function finishSession(lessonSlug: string, score: number): Promise<Streak> {
  try {
    const db = getDB();
    if (lessonSlug !== "review") {
      const prev = await db.lessonProgress.get(lessonSlug);
      await db.lessonProgress.put({
        lessonSlug,
        bestScore: Math.max(prev?.bestScore ?? 0, score),
        attempts: (prev?.attempts ?? 0) + 1,
        completedAt: Date.now(),
      });
    }
    await bumpToday().catch(() => {});
    return await bumpStreak();
  } catch {
    return EMPTY_STREAK;
  }
}

/** Words to review: due now, weakest first (most wrong answers relative to right ones). */
export async function weakItemIds(limit = 8): Promise<string[]> {
  try {
    const due = await getDB().itemStats.where("dueAt").belowOrEqual(Date.now()).toArray();
    return due
      .filter((r) => r.wrong > 0 || r.intervalDays <= 2)
      .sort((a, b) => b.wrong - b.correct * 0.5 - (a.wrong - a.correct * 0.5))
      .slice(0, limit)
      .map((r) => r.itemId);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- Account sync

/** Everything Learn keeps on this phone, in the shape the account sync understands. */
async function localSnapshot(): Promise<Snapshot> {
  const db = getDB();
  const [lessons, items, streakRow] = await Promise.all([db.lessonProgress.toArray(), db.itemStats.toArray(), db.meta.get("streak")]);
  const streak = (streakRow?.value as Streak | undefined) ?? EMPTY_STREAK;
  return {
    lessons: lessons.map((l) => ({ slug: l.lessonSlug, bestScore: l.bestScore, attempts: l.attempts, completedAt: l.completedAt })),
    items: items.map((i) => ({
      itemId: i.itemId,
      correct: i.correct,
      wrong: i.wrong,
      intervalDays: Math.max(1, i.intervalDays),
      dueAt: i.dueAt,
      lastSeen: i.lastSeen,
      ...(i.wrongSession ? { wrongSession: i.wrongSession } : {}),
    })),
    streak: { current: streak.current, longest: streak.longest, lastDay: streak.lastDay },
  };
}

async function applySnapshot(s: Snapshot): Promise<void> {
  const db = getDB();
  await db.transaction("rw", db.lessonProgress, db.itemStats, db.meta, async () => {
    await db.lessonProgress.bulkPut(
      s.lessons.map((l) => ({ lessonSlug: l.slug, bestScore: l.bestScore, attempts: l.attempts, completedAt: l.completedAt })),
    );
    await db.itemStats.bulkPut(s.items.map((i) => ({ ...i })));
    await db.meta.put({ key: "streak", value: s.streak });
  });
}

let inFlight: Promise<boolean> | null = null;

/**
 * Merge this phone's progress with the signed-in account (both directions).
 * Returns true when something on this phone changed. Signed out or offline: does nothing.
 */
export function syncWithAccount(): Promise<boolean> {
  inFlight ??= (async () => {
    try {
      const before = await localSnapshot();
      const result = await syncLearning(before);
      if (!result.signedIn || !result.ok) return false;
      if (JSON.stringify(result.snapshot) === JSON.stringify(mergeSnapshots(before, emptySnapshot()))) return false;
      await applySnapshot(result.snapshot);
      return true;
    } catch {
      return false; // offline, storage blocked, server error: try again next time
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
