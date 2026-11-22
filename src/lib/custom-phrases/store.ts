"use client";

// Own Quick Talk phrases on this phone (IndexedDB), synced with the account when signed in.
// Fails soft like the rest of the device store: blocked storage → empty list, nothing saved.

import { getDB, type CustomPhraseRow } from "@/lib/offline-db";
import { SIGNED_IN_HINT } from "@/lib/supabase/cookies";
import { MAX_CUSTOM_PHRASES, MAX_PHRASE_CHARS, mergeCustomPhrases } from "./merge";

export const OWN_PREFIX = "own:";

/** Live phrases, newest first. */
export async function listCustomPhrases(): Promise<CustomPhraseRow[]> {
  try {
    const rows = await getDB().customPhrases.toArray();
    return rows.filter((r) => !r.deleted).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/** Add (no id) or edit. Returns false when the list is full or storage is blocked. */
export async function saveCustomPhrase(input: { id?: string; tr: string; sq: string }): Promise<boolean> {
  try {
    const db = getDB();
    const tr = input.tr.trim().slice(0, MAX_PHRASE_CHARS);
    const sq = input.sq.trim().slice(0, MAX_PHRASE_CHARS);
    return await db.transaction("rw", db.customPhrases, async () => {
      const existing = input.id ? await db.customPhrases.get(input.id) : undefined;
      if (!existing) {
        const live = await db.customPhrases.filter((r) => !r.deleted).count();
        if (live >= MAX_CUSTOM_PHRASES) return false;
      }
      await db.customPhrases.put({
        id: existing?.id ?? crypto.randomUUID(),
        tr,
        sq,
        // Never earlier than the last change, so a clock that jumped back can't lose the edit.
        updatedAt: Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1),
        deleted: false,
      });
      return true;
    });
  } catch {
    return false;
  }
}

export async function deleteCustomPhrase(id: string): Promise<void> {
  try {
    const db = getDB();
    const existing = await db.customPhrases.get(id);
    if (existing) await db.customPhrases.put({ ...existing, updatedAt: Math.max(Date.now(), existing.updatedAt + 1), deleted: true });
  } catch {
    /* not saved */
  }
}

const looksSignedIn = () => document.cookie.split("; ").includes(`${SIGNED_IN_HINT}=1`);
let running: Promise<boolean> | null = null;

/** Merge with the account (signed in only). Returns true when this phone's list changed. */
export function syncCustomPhrasesWithAccount(): Promise<boolean> {
  if (running) return running;
  running = (async () => {
    try {
      if (!looksSignedIn()) return false;
      const db = getDB();
      const local = await db.customPhrases.toArray();
      const { syncCustomPhrases } = await import("./sync-action");
      const result = await syncCustomPhrases(local);
      if (!result.ok) return false;
      const merged = mergeCustomPhrases(local, result.rows);
      const changed = JSON.stringify(merged) !== JSON.stringify(mergeCustomPhrases(local, []));
      if (changed) await db.customPhrases.bulkPut(merged);
      return changed;
    } catch {
      return false;
    } finally {
      running = null;
    }
  })();
  return running;
}
