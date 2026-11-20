// Merging Quick Talk favourites from two places (this phone + the account).
//
// Each phrase has one entry: pinned or removed (a tombstone), with the time of that change.
// Rule per phrase: the newer change wins; at the same time a removal wins. Then at most 6
// stay pinned (the most recently pinned); older pins become tombstones with their own time.
// Order = pin order, oldest first. Pure and symmetric: merge(a, b) equals merge(b, a), and
// merging the result again changes nothing, so syncing twice or from several phones is safe.
//
// The same rules run in Postgres (`sync_favorites` in supabase/migrations/*_favorites_sync.sql).

export const MAX_FAVORITES = 6;

/** One phrase's favourite state. `deleted` = unpinned (tombstone). Times in ms since epoch. */
export type FavSnap = { phraseId: string; deleted: boolean; updatedAt: number };

/** Phrase ids in the database are slugs "qt-<id>". */
export const toSlug = (phraseId: string) => `qt-${phraseId}`;
export const fromSlug = (slug: string) => (slug.startsWith("qt-") ? slug.slice(3) : null);

const newer = (x: FavSnap, y: FavSnap): FavSnap => {
  if (x.updatedAt !== y.updatedAt) return x.updatedAt > y.updatedAt ? x : y;
  return x.deleted ? x : y; // same time: the removal wins
};

const byPinOrder = (x: FavSnap, y: FavSnap) => x.updatedAt - y.updatedAt || (x.phraseId < y.phraseId ? -1 : x.phraseId > y.phraseId ? 1 : 0);

export function mergeFavorites(a: FavSnap[], b: FavSnap[]): FavSnap[] {
  const out = new Map<string, FavSnap>();
  for (const row of [...a, ...b]) {
    const prev = out.get(row.phraseId);
    out.set(row.phraseId, prev ? newer(prev, row) : row);
  }
  // Keep the newest 6 pins (ties: the same order Postgres uses).
  const pinned = [...out.values()].filter((r) => !r.deleted).sort(byPinOrder);
  for (const old of pinned.slice(0, Math.max(0, pinned.length - MAX_FAVORITES))) {
    out.set(old.phraseId, { ...old, deleted: true });
  }
  return [...out.values()]
    .map((r) => ({ phraseId: r.phraseId, deleted: r.deleted, updatedAt: r.updatedAt }))
    .sort((x, y) => (x.phraseId < y.phraseId ? -1 : x.phraseId > y.phraseId ? 1 : 0));
}

/** The pinned phrase ids, in pin order. */
export function pinnedIds(rows: FavSnap[]): string[] {
  return rows
    .filter((r) => !r.deleted)
    .sort(byPinOrder)
    .map((r) => r.phraseId);
}
