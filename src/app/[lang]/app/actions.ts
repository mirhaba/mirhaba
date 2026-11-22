"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { defaultLocale, hasLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/rate-limit";
import { passwordProblem, type PasswordProblem } from "@/lib/password";
import { MAX_REWARDED_INVITES, REFERRAL_COOKIE } from "@/lib/referral";

/** Bump when the terms/privacy text changes materially; users are asked again. */
const CONSENT_VERSION = "2026-11";

type Result = { ok: true } | { ok: false };

const langSchema = z.custom<Locale>((v) => typeof v === "string" && hasLocale(v));

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect(`/${defaultLocale}/login`);
  return { supabase, user: data.user };
}

/**
 * First-login consent: 16+ and terms/privacy (required), marketing (optional).
 * A new account that arrived through an invite link is rewarded here (`invited: true`).
 */
export async function acceptConsent(input: { accepted: boolean; marketing: boolean }): Promise<Result | { ok: true; invited: boolean }> {
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
  if (error) return { ok: false };

  // Invite link: 7 days of Premium for both (SQL checks: new account, not self, once, inviter cap).
  const jar = await cookies();
  const code = jar.get(REFERRAL_COOKIE)?.value;
  let invited = false;
  if (code) {
    jar.delete(REFERRAL_COOKIE);
    if (/^[A-Z2-9]{8}$/.test(code) && (await checkLimit("referralUser", user.id))) {
      const { data } = await supabase.rpc("claim_referral", { p_code: code });
      invited = data === true;
    }
  }
  return { ok: true, invited };
}

export type InviteInfo = { ok: true; code: string; invited: number; max: number } | { ok: false };

/** The signed-in person's invite code (made on first use) and how many friends joined with it. */
export async function getInviteInfo(): Promise<InviteInfo> {
  const { supabase, user } = await requireUser();
  if (!(await checkLimit("referralUser", user.id))) return { ok: false };
  const [{ data: code, error }, { count }] = await Promise.all([
    supabase.rpc("my_referral_code"),
    supabase.from("referrals").select("referred_id", { count: "exact", head: true }).eq("referrer_id", user.id),
  ]);
  if (error || typeof code !== "string") return { ok: false };
  return { ok: true, code, invited: count ?? 0, max: MAX_REWARDED_INVITES };
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

export type PasswordResult = { ok: true } | { ok: false; error: PasswordProblem | "same" | "reauth" | "tooMany" | "generic" };

/** Set a password (accounts that signed in with email codes) or change it. The session proves who it is. */
export async function setPassword(password: unknown): Promise<PasswordResult> {
  if (typeof password !== "string") return { ok: false, error: "generic" };
  const { supabase, user } = await requireUser();
  const problem = passwordProblem(password, user.email);
  if (problem) return { ok: false, error: problem };
  if (!(await checkLimit("setPasswordUser", user.id))) return { ok: false, error: "tooMany" };

  // password_set: lets the account page say "Change password" from now on.
  const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } });
  if (!error) return { ok: true };
  if (error.code === "same_password") return { ok: false, error: "same" };
  if (error.code === "weak_password") return { ok: false, error: "tooCommon" };
  if (error.code === "reauthentication_needed" || error.code === "reauthentication_not_valid") return { ok: false, error: "reauth" };
  if (error.status === 429) return { ok: false, error: "tooMany" };
  return { ok: false, error: "generic" };
}
