"use server";

import { cookies, headers } from "next/headers";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { afterLoginPath, safeNextPath } from "@/lib/safe-redirect";
import { checkLimits, clientIp } from "@/lib/rate-limit";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";
import { siteUrl } from "@/lib/site";

export type AuthError = "invalidEmail" | "invalidCode" | "wrongCode" | "tooMany" | "captcha" | "generic";
export type AuthResult = { ok: true } | { ok: false; error: AuthError };

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const codeSchema = z.string().trim().regex(/^\d{6}$/);
const langSchema = z.custom<Locale>((v) => typeof v === "string" && hasLocale(v));

function mapError(error: { status?: number; code?: string } | null): AuthError {
  if (!error) return "generic";
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") return "tooMany";
  if (error.code === "captcha_failed") return "captcha";
  if (error.code === "email_address_invalid" || error.code === "validation_failed") return "invalidEmail";
  if (error.code === "otp_expired" || error.code === "invalid_credentials" || error.status === 403) return "wrongCode";
  return "generic";
}

/** The origin the visitor is on (so preview deployments get links back to themselves). */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return siteUrl;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Step 1: email a sign-in code and link. Creates the account on first use (profile trigger stores ui_lang).
 *
 * The email may contain a 6-digit code ({{ .Token }}), a link ({{ .ConfirmationURL }}) or both,
 * depending on the template set in the Supabase dashboard. We send with the implicit flow so the
 * link works even when it opens in a different browser than the one that asked for it (e.g. the
 * Gmail in-app browser): the session arrives in the URL fragment and AuthLinkHandler stores it.
 */
export async function sendCode(input: { lang: string; email: string; captchaToken?: string; next?: string }): Promise<AuthResult> {
  const email = emailSchema.safeParse(input.email);
  const lang = langSchema.safeParse(input.lang);
  if (!email.success || !lang.success) return { ok: false, error: "invalidEmail" };

  // Stop email-bombing: per IP and per address.
  const ip = await clientIp();
  if (!(await checkLimits([["sendCodeIp", ip], ["sendCodeEmail", email.data]]))) return { ok: false, error: "tooMany" };

  const next = safeNextPath(input.next, lang.data);
  const supabase = createPlainClient(supabaseUrl, supabasePublishableKey, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo: `${await requestOrigin()}/${lang.data}/login?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
      data: { ui_lang: lang.data },
      captchaToken: input.captchaToken || undefined,
    },
  });
  return error ? { ok: false, error: mapError(error) } : { ok: true };
}

/** Step 2: check the code; on success the session cookies are set and we go to `next`. */
export async function verifyCode(input: { lang: string; email: string; code: string; next?: string }): Promise<AuthResult> {
  const email = emailSchema.safeParse(input.email);
  const code = codeSchema.safeParse(input.code);
  const lang = langSchema.safeParse(input.lang);
  if (!lang.success || !email.success) return { ok: false, error: "invalidEmail" };
  if (!code.success) return { ok: false, error: "invalidCode" };

  // Stop code guessing: per IP and per address.
  const ip = await clientIp();
  if (!(await checkLimits([["verifyCodeIp", ip], ["verifyCodeEmail", email.data]]))) return { ok: false, error: "tooMany" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email: email.data, token: code.data, type: "email" });
  if (error || !data.user) return { ok: false, error: mapError(error) };

  // Continue in the language saved on the profile.
  const { data: profile } = await supabase.from("profiles").select("ui_lang, age_confirmed_at").eq("id", data.user.id).single();
  const uiLang: Locale = profile?.ui_lang === "sq" ? "sq" : profile?.ui_lang === "tr" ? "tr" : lang.data;
  (await cookies()).set(LOCALE_COOKIE, uiLang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  redirect(afterLoginPath(safeNextPath(input.next, uiLang), uiLang, !!profile?.age_confirmed_at));
}
