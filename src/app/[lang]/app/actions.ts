"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";

/** Bump when the terms/privacy text changes materially; users are asked again. */
const CONSENT_VERSION = "2026-11";

type Result = { ok: true } | { ok: false };

const langSchema = z.custom<Locale>((v) => typeof v === "string" && hasLocale(v));

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/tr/login");
  return { supabase, user: data.user };
}

/** First-login consent: 16+ and terms/privacy (required), marketing (optional). */
export async function acceptConsent(input: { accepted: boolean; marketing: boolean }): Promise<Result> {
  const parsed = z.object({ accepted: z.literal(true), marketing: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const { supabase, user } = await requireUser();

  const rows = (["terms", "privacy", "age_16"] as const).map((type) => ({
    user_id: user.id,
    type,
    version: CONSENT_VERSION,
    granted: true,
  }));
  rows.push({ user_id: user.id, type: "marketing" as never, version: CONSENT_VERSION, granted: parsed.data.marketing });

  const { error: consentError } = await supabase.from("consents").insert(rows);
  if (consentError) return { ok: false };

  const { error } = await supabase
    .from("profiles")
    .update({ age_confirmed_at: new Date().toISOString(), marketing_opt_in: parsed.data.marketing })
    .eq("id", user.id);
  return error ? { ok: false } : { ok: true };
}

export async function setMarketing(enabled: boolean): Promise<Result> {
  if (typeof enabled !== "boolean") return { ok: false };
  const { supabase, user } = await requireUser();
  const [{ error: a }, { error: b }] = await Promise.all([
    supabase.from("profiles").update({ marketing_opt_in: enabled }).eq("id", user.id),
    supabase.from("consents").insert({ user_id: user.id, type: "marketing", version: CONSENT_VERSION, granted: enabled }),
  ]);
  return a || b ? { ok: false } : { ok: true };
}

/** Saves the interface language on the profile and in the cookie, then reloads in that language. */
export async function setLanguage(input: string): Promise<Result> {
  const lang = langSchema.safeParse(input);
  if (!lang.success) return { ok: false };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ ui_lang: lang.data }).eq("id", user.id);
  if (error) return { ok: false };
  (await cookies()).set(LOCALE_COOKIE, lang.data, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(`/${lang.data}/app`);
}

/** "local" = this device, "global" = every device (revokes all refresh tokens). */
export async function signOut(input: { lang: string; everywhere: boolean }) {
  const lang = langSchema.safeParse(input.lang);
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: input.everywhere ? "global" : "local" });
  redirect(`/${lang.success ? lang.data : "tr"}`);
}

/** GDPR erasure: deletes the auth user (cascades to profile, progress, favourites…). */
export async function deleteAccount(input: { lang: string }): Promise<Result> {
  const lang = langSchema.safeParse(input.lang);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false };
  // The user no longer exists; clear the session cookies locally.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  redirect(`/${lang.success ? lang.data : "tr"}`);
}
