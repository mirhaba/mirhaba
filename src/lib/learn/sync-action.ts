"use server";

import { createClient } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/rate-limit";
import { mergeSnapshots, snapshotSchema, type ItemSnap, type LessonSnap, type Snapshot } from "./merge";
import { progressSlug, splitProgressSlug, type Course } from "./course";

export type SyncResult = { signedIn: false } | { signedIn: true; ok: true; snapshot: Snapshot } | { signedIn: true; ok: false };

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (value: string | null) => (value ? Date.parse(value) : 0);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Merge this phone's Learn progress with the account's and save the result in both places.
 * Runs as the signed-in user (RLS applies: only their own rows). Signed-out: does nothing.
 */
export async function syncLearning(raw: unknown): Promise<SyncResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { signedIn: false };
  const userId = auth.user.id;

  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) return { signedIn: true, ok: false };
  if (!(await checkLimit("learnSyncUser", userId))) return { signedIn: true, ok: false };

  // ---------- Read the account's copy ----------
  const [progress, items, learning] = await Promise.all([
    supabase.from("user_progress").select("course, score, attempts, completed_at, lessons(slug)"),
    supabase.from("user_item_stats").select("item_id, correct, wrong, interval_days, due_at, last_seen, wrong_session"),
    supabase.from("user_learning").select("streak_current, streak_longest, streak_last_day").maybeSingle(),
  ]);
  if (progress.error || items.error || learning.error) return { signedIn: true, ok: false };

  const server: Snapshot = {
    lessons: progress.data.flatMap((row): LessonSnap[] => {
      const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
      return lesson?.slug
        ? [{ slug: progressSlug(lesson.slug, row.course === "tr" ? "tr" : "sq"), bestScore: row.score, attempts: row.attempts, completedAt: ms(row.completed_at) }]
        : [];
    }),
    items: items.data.map(
      (row): ItemSnap => ({
        itemId: row.item_id,
        correct: row.correct,
        wrong: row.wrong,
        intervalDays: row.interval_days,
        dueAt: ms(row.due_at),
        lastSeen: ms(row.last_seen),
        ...(row.wrong_session ? { wrongSession: row.wrong_session } : {}),
      }),
    ),
    streak: {
      current: learning.data?.streak_current ?? 0,
      longest: learning.data?.streak_longest ?? 0,
      lastDay: learning.data?.streak_last_day ?? null,
    },
  };

  const merged = mergeSnapshots(parsed.data, server);

  // ---------- Write back only what changed on the account ----------
  const serverLessons = new Map(server.lessons.map((l) => [l.slug, l]));
  const changedLessons = merged.lessons.filter((l) => !same(serverLessons.get(l.slug), l));
  const serverItems = new Map(server.items.map((i) => [i.itemId, i]));
  const changedItems = merged.items.filter((i) => !same(serverItems.get(i.itemId), i));

  const writes: PromiseLike<{ error: unknown }>[] = [];

  if (changedLessons.length) {
    const { data: ids, error } = await supabase
      .from("lessons")
      .select("id, slug")
      .in(
        "slug",
        [...new Set(changedLessons.map((l) => splitProgressSlug(l.slug).slug))],
      );
    if (error) return { signedIn: true, ok: false };
    const idBySlug = new Map(ids.map((r) => [r.slug, r.id]));
    const rows = changedLessons
      .map((l) => ({ ...l, ...splitProgressSlug(l.slug) }) as LessonSnap & { course: Course })
      .filter((l) => idBySlug.has(l.slug)) // lessons unknown to the database stay on the phone only
      .map((l) => ({
        user_id: userId,
        lesson_id: idBySlug.get(l.slug)!,
        course: l.course,
        score: l.bestScore,
        attempts: l.attempts,
        completed_at: l.completedAt ? iso(l.completedAt) : null,
        last_seen: iso(Date.now()),
      }));
    if (rows.length) writes.push(supabase.from("user_progress").upsert(rows));
  }

  if (changedItems.length) {
    writes.push(
      supabase.from("user_item_stats").upsert(
        changedItems.map((i) => ({
          user_id: userId,
          item_id: i.itemId,
          correct: i.correct,
          wrong: i.wrong,
          interval_days: i.intervalDays,
          due_at: iso(i.dueAt),
          last_seen: iso(i.lastSeen),
          wrong_session: i.wrongSession ?? null,
        })),
      ),
    );
  }

  if (!same(merged.streak, server.streak)) {
    writes.push(
      supabase.from("user_learning").upsert({
        user_id: userId,
        streak_current: merged.streak.current,
        streak_longest: merged.streak.longest,
        streak_last_day: merged.streak.lastDay,
      }),
    );
  }

  const results = await Promise.all(writes);
  if (results.some((r) => r.error)) return { signedIn: true, ok: false };
  return { signedIn: true, ok: true, snapshot: merged };
}
