"use server";

import { createClient } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/rate-limit";
import { customPhrasesSchema, mergeCustomPhrases, type CustomPhrase } from "./merge";

export type CustomSyncResult = { ok: true; rows: CustomPhrase[] } | { ok: false };

const same = (a: CustomPhrase | undefined, b: CustomPhrase) =>
  !!a && a.tr === b.tr && a.sq === b.sq && a.deleted === b.deleted && a.updatedAt === b.updatedAt;

/**
 * Merge this phone's own phrases into the account and return the account's merged list.
 * Runs as the signed-in user (RLS: own rows only). Times in the future count as now.
 */
export async function syncCustomPhrases(raw: unknown): Promise<CustomSyncResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const parsed = customPhrasesSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  if (!(await checkLimit("customPhrasesSyncUser", auth.user.id))) return { ok: false };

  const now = Date.now();
  const phone = parsed.data.map((r) => ({ ...r, updatedAt: Math.min(r.updatedAt, now) }));

  const { data, error } = await supabase.from("custom_phrases").select("id, tr, sq, deleted, updated_at");
  if (error) return { ok: false };
  const server: CustomPhrase[] = data.map((r) => ({ id: r.id, tr: r.tr, sq: r.sq, deleted: r.deleted, updatedAt: Date.parse(r.updated_at) }));

  const merged = mergeCustomPhrases(phone, server);
  const byId = new Map(server.map((r) => [r.id, r]));
  const changed = merged.filter((r) => !same(byId.get(r.id), r));
  if (changed.length) {
    const { error: writeError } = await supabase.from("custom_phrases").upsert(
      changed.map((r) => ({
        user_id: auth.user.id,
        id: r.id,
        tr: r.tr,
        sq: r.sq,
        deleted: r.deleted,
        updated_at: new Date(r.updatedAt).toISOString(),
      })),
    );
    if (writeError) return { ok: false };
  }
  return { ok: true, rows: merged };
}
