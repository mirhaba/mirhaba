"use client";

// On-device store (IndexedDB via Dexie). Holds data that must work offline:
// Quick Talk favourites and Learn progress. Both stay on the phone and, for signed-in
// users, are merged with the account (src/lib/favorites/sync.ts, src/lib/learn/progress.ts).

import Dexie, { type EntityTable } from "dexie";
import { MAX_FAVORITES, pinnedIds } from "@/lib/favorites/merge";

export { MAX_FAVORITES };

/**
 * One row per phrase ever pinned. `deleted` = unpinned (a tombstone, kept so the unpin also
 * reaches the account and the other phones). Pinned rows are ordered by `updatedAt` (pin time).
 */
export type FavoriteRow = { phraseId: string; updatedAt: number; deleted: boolean };

/** Learn: best result per lesson. */
export type LessonProgressRow = { lessonSlug: string; bestScore: number; attempts: number; completedAt: number };
/** Learn: how well each word is known (simple spaced repetition). */
export type ItemStatRow = {
  itemId: string;
  correct: number;
  wrong: number;
  intervalDays: number;
  dueAt: number;
  lastSeen: number;
  /** Session in which it was last answered wrong: a right answer in the same session doesn't clear it. */
  wrongSession?: string;
};
/** Small key/value settings, e.g. the learning streak. */
export type MetaRow = { key: string; value: unknown };

class MirhabaDB extends Dexie {
  favorites!: EntityTable<FavoriteRow, "phraseId">;
  lessonProgress!: EntityTable<LessonProgressRow, "lessonSlug">;
  itemStats!: EntityTable<ItemStatRow, "itemId">;
  meta!: EntityTable<MetaRow, "key">;

  constructor() {
    super("mirhaba");
    this.version(1).stores({ favorites: "phraseId, position" });
    // v2: Learn Albanian progress (kept on the phone; works offline, no account needed).
    this.version(2).stores({
      favorites: "phraseId, position",
      lessonProgress: "lessonSlug",
      itemStats: "itemId, dueAt",
      meta: "key",
    });
    // v3: favourites sync with the account. Position → pin time + tombstones (the order is kept).
    this.version(3)
      .stores({ favorites: "phraseId, updatedAt" })
      .upgrade(async (tx) => {
        const base = Date.now() - MAX_FAVORITES;
        await tx
          .table("favorites")
          .toCollection()
          .modify((row: { position?: number; updatedAt?: number; deleted?: boolean }) => {
            row.updatedAt = base + (row.position ?? 0);
            row.deleted = false;
            delete row.position;
          });
      });
  }
}

let db: MirhabaDB | null = null;

/** Lazily opened so server rendering never touches IndexedDB. */
export function getDB(): MirhabaDB {
  db ??= new MirhabaDB();
  return db;
}

/** Pinned phrase ids in pin order. */
export async function listFavorites(): Promise<string[]> {
  try {
    return pinnedIds(await getDB().favorites.toArray());
  } catch {
    // Private mode / storage blocked: the app still works, just without pins.
    return [];
  }
}

/**
 * Pin or unpin. Returns the new list, or null when the list is already full.
 * `exists` tells which phrases are still on the site: pins of phrases deleted in the admin are
 * invisible, so they don't count towards the limit.
 */
export async function toggleFavorite(phraseId: string, exists: (id: string) => boolean = () => true): Promise<string[] | null> {
  const db = getDB();
  const full = await db.transaction("rw", db.favorites, async () => {
    const rows = await db.favorites.toArray();
    const pinned = rows.filter((r) => !r.deleted);
    const visible = pinned.filter((r) => exists(r.phraseId));
    // Pins of phrases this page doesn't show (deleted in the admin, or newer than this cached page).
    const stale = pinned.filter((r) => !exists(r.phraseId) && r.phraseId !== phraseId).sort((a, b) => a.updatedAt - b.updatedAt);
    const existing = rows.find((r) => r.phraseId === phraseId);
    // Never earlier than this phrase's last change or the newest pin, so the order and the
    // sync stay right even if the phone's clock jumps back.
    const now = Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1, ...pinned.map((r) => r.updatedAt + 1));
    if (existing && !existing.deleted) {
      await db.favorites.put({ phraseId, updatedAt: now, deleted: true });
      return false;
    }
    if (visible.length >= MAX_FAVORITES) return true;
    // Only when a slot is needed: free it from the oldest invisible pins (the merge keeps at most
    // 6 pins, visible or not, so otherwise a visible pin could be dropped instead).
    const over = pinned.length + 1 - MAX_FAVORITES;
    if (over > 0) await db.favorites.bulkPut(stale.slice(0, over).map((r) => ({ phraseId: r.phraseId, updatedAt: now, deleted: true })));
    await db.favorites.put({ phraseId, updatedAt: now, deleted: false });
    return false;
  });
  return full ? null : listFavorites();
}
