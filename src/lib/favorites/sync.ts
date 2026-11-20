"use client";

// Quick Talk favourites ↔ account. Loaded lazily (after the first screen is idle) so it
// never delays Quick Talk. Signed out, offline or on any error it does nothing: the pins
// simply stay on the phone and sync next time.

import { getDB } from "@/lib/offline-db";
import { SIGNED_IN_HINT } from "@/lib/supabase/cookies";
import { mergeFavorites } from "./merge";
import { syncFavorites } from "./sync-action";

const looksSignedIn = () => document.cookie.split("; ").includes(`${SIGNED_IN_HINT}=1`);
const forgetSignedIn = () => {
  document.cookie = `${SIGNED_IN_HINT}=; Max-Age=0; Path=/; SameSite=Lax`;
};

let running: Promise<boolean> | null = null;
let again = false;

/**
 * Send this phone's favourites (pins + tombstones) to the account and merge the account's
 * list back in. Returns true when the pins on this phone changed. Calls made while a sync
 * is running are folded into one extra round, so quick pin/unpin taps never pile up requests.
 */
export function syncFavoritesWithAccount(): Promise<boolean> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let changed = false;
    try {
      do {
        again = false;
        if (!navigator.onLine || !looksSignedIn()) break;
        const db = getDB();
        const local = await db.favorites.toArray();
        const result = await syncFavorites(local.map(({ phraseId, deleted, updatedAt }) => ({ phraseId, deleted, updatedAt })));
        if (!result.signedIn) {
          forgetSignedIn(); // the session ended: stop asking until the next sign-in
          break;
        }
        if (!result.ok) break;
        // Merge into what is on the phone *now*, so a pin made during the request is kept.
        const wrote = await db.transaction("rw", db.favorites, async () => {
          const current = await db.favorites.toArray();
          const before = new Map(current.map((r) => [r.phraseId, r]));
          const diff = mergeFavorites(current, result.rows).filter((r) => {
            const b = before.get(r.phraseId);
            return !b || b.deleted !== r.deleted || b.updatedAt !== r.updatedAt;
          });
          if (diff.length) await db.favorites.bulkPut(diff);
          return diff.length > 0;
        });
        changed ||= wrote;
      } while (again);
    } catch {
      // offline, storage blocked, server error: try again next time
    } finally {
      running = null;
      again = false;
    }
    return changed;
  })();
  return running;
}
