"use server";

import { createClient } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/rate-limit";
import { sanitizePreferences, type Preferences } from "@/lib/preferences-schema";

export type PrefsSyncResult =
  | { signedIn: false }
  | { signedIn: true; ok: false }
  /** `prefs` is null when the phone's copy won (nothing to adopt). */
  | { signedIn: true; ok: true; prefs: Preferences | null; updatedAt: number; account: string };

/**
 * The newer copy wins: the phone's (sent here with its change time) or the account's. Clocks in the
 * future count as now. `account` is the account this phone last synced with: on a phone new to this
 * account, the account's saved preferences win (the phone's are usually just the defaults).
 */
export async function syncPreferences(input: { prefs: unknown; updatedAt: unknown; account?: unknown }): Promise<PrefsSyncResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { signedIn: false };
  if (typeof input?.updatedAt !== "number" || !Number.isFinite(input.updatedAt) || input.updatedAt < 0) {
    return { signedIn: true, ok: false };
  }
  if (!(await checkLimit("preferencesSyncUser", auth.user.id))) return { signedIn: true, ok: false };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("preferences, preferences_updated_at")
    .eq("id", auth.user.id)
    .single();
  if (error) return { signedIn: true, ok: false };

  const serverAt = profile.preferences_updated_at ? Date.parse(profile.preferences_updated_at) : 0;
  const phoneAt = Math.min(input.updatedAt, Date.now());
  const account = auth.user.id;
  const newPhone = input.account !== account;

  if (newPhone && serverAt > 0) {
    return { signedIn: true, ok: true, prefs: sanitizePreferences(profile.preferences), updatedAt: serverAt, account };
  }
  if (phoneAt > serverAt) {
    const prefs = sanitizePreferences(input.prefs);
    const { error: writeError } = await supabase
      .from("profiles")
      .update({ preferences: prefs, preferences_updated_at: new Date(phoneAt).toISOString() })
      .eq("id", auth.user.id);
    return writeError ? { signedIn: true, ok: false } : { signedIn: true, ok: true, prefs: null, updatedAt: phoneAt, account };
  }
  if (serverAt > phoneAt) {
    return { signedIn: true, ok: true, prefs: sanitizePreferences(profile.preferences), updatedAt: serverAt, account };
  }
  return { signedIn: true, ok: true, prefs: null, updatedAt: serverAt, account };
}
