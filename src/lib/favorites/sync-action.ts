"use server";

import { createClient } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/rate-limit";
import { fromSlug, toSlug, type FavSnap } from "./merge";
import { favSnapshotSchema } from "./schema";

export type FavSyncResult = { signedIn: false } | { signedIn: true; ok: true; rows: FavSnap[] } | { signedIn: true; ok: false };

type ServerRow = { slug: string; deleted: boolean; updated_at: number };

/**
 * Merge this phone's Quick Talk favourites into the account (Postgres applies the rules
 * atomically, see `sync_favorites`) and return the account's merged list.
 * Runs as the signed-in user (RLS: own rows only). Signed out: does nothing.
 */
export async function syncFavorites(raw: unknown): Promise<FavSyncResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { signedIn: false };

  const parsed = favSnapshotSchema.safeParse(raw);
  if (!parsed.success) return { signedIn: true, ok: false };
  if (!(await checkLimit("favoritesSyncUser", auth.user.id))) return { signedIn: true, ok: false };

  const { data, error } = await supabase.rpc("sync_favorites", {
    p_items: parsed.data.map((r) => ({ slug: toSlug(r.phraseId), deleted: r.deleted, updated_at: r.updatedAt })),
  });
  if (error || !Array.isArray(data)) return { signedIn: true, ok: false };

  const rows = (data as ServerRow[]).flatMap((r): FavSnap[] => {
    const phraseId = fromSlug(r.slug);
    return phraseId ? [{ phraseId, deleted: r.deleted, updatedAt: Number(r.updated_at) }] : [];
  });
  return { signedIn: true, ok: true, rows };
}
