"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/rate-limit";

// Daily reminder settings, one row per browser (push subscription) in `push_subscriptions`.
// Runs as the signed-in user (RLS: own rows only). The sender is /api/cron/reminders.

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

const settingsSchema = z.object({
  subscription: subscriptionSchema,
  remindAt: z.number().int().min(0).max(1439),
  timeZone: z.string().min(1).max(64),
});

export type ReminderResult = { ok: true } | { ok: false; error: "signedOut" | "invalid" | "tooMany" | "generic" };

/** Turn reminders on for this browser, or change the time. */
export async function saveReminder(input: unknown): Promise<ReminderResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "signedOut" };
  if (!(await checkLimit("remindersUser", auth.user.id))) return { ok: false, error: "tooMany" };

  const { subscription, remindAt, timeZone } = parsed.data;
  const row = { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, remind_at: remindAt, time_zone: timeZone, enabled: true };

  // Same browser again: update. The endpoint is unique; a row of another account can't be seen (RLS), so the insert fails then.
  const { data: existing } = await supabase.from("push_subscriptions").select("id").eq("endpoint", subscription.endpoint).maybeSingle();
  const { error } = existing
    ? await supabase.from("push_subscriptions").update(row).eq("id", existing.id)
    : await supabase.from("push_subscriptions").insert({ ...row, user_id: auth.user.id, endpoint: subscription.endpoint });
  return error ? { ok: false, error: "generic" } : { ok: true };
}

/** Turn reminders off for this browser. */
export async function removeReminder(endpoint: unknown): Promise<ReminderResult> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "signedOut" };
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return error ? { ok: false, error: "generic" } : { ok: true };
}

/** This browser's reminder time (minutes after midnight), or null when off. */
export async function getReminder(endpoint: unknown): Promise<{ remindAt: number } | null> {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("push_subscriptions").select("remind_at, enabled").eq("endpoint", endpoint).maybeSingle();
  return data?.enabled ? { remindAt: data.remind_at } : null;
}
