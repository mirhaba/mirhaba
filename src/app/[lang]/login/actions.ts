"use server";

import { cookies } from "next/headers";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { afterLoginPath, safeNextPath } from "@/lib/safe-redirect";
import { checkLimits, clientIp } from "@/lib/rate-limit";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";
import { requestOrigin } from "@/lib/request-origin";
import { passwordProblem, PASSWORD_MAX, type PasswordProblem } from "@/lib/password";

export type AuthError =
  | "invalidEmail"
  | "wrongCode"
  | "wrongPassword"
  | "unconfirmed"
  | "exists"
  | "tooMany"
  | "captcha"
  | "generic"
  | PasswordProblem;
export type AuthResult = { ok: true } | { ok: false; error: AuthError };
/** Sign-up: "code" = a confirmation link was emailed (the usual case); a direct sign-in redirects instead. */
export type SignUpResult = { ok: true; step: "code" } | { ok: false; error: AuthError };

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const langSchema = z.custom<Locale>((v) => typeof v === "string" && hasLocale(v));
// Length only here; the rules (and their messages) come from passwordProblem().
const passwordSchema = z.string().min(1).max(PASSWORD_MAX * 4);

function mapError(error: { status?: number; code?: string } | null): AuthError {
  if (!error) return "generic";
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") return "tooMany";
  if (error.code === "captcha_failed") return "captcha";
  if (error.code === "email_address_invalid" || error.code === "validation_failed") return "invalidEmail";
  if (error.code === "email_not_confirmed") return "unconfirmed";
  if (error.code === "weak_password") return "tooCommon";
  if (error.code === "user_already_exists" || error.code === "email_exists") return "exists";
  if (error.code === "otp_expired" || error.code === "invalid_credentials" || error.status === 403) return "wrongCode";
  return "generic";
}

/** A Supabase client that doesn't touch cookies; email links it creates carry the session in the fragment. */
function implicitClient() {
  return createPlainClient(supabaseUrl, supabasePublishableKey, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** After any successful sign-in: remember the profile's language and continue (consent first if needed). */
async function finishSignIn(userId: string, fallbackLang: Locale, next: string | undefined): Promise<never> {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("ui_lang, age_confirmed_at").eq("id", userId).single();
  const uiLang: Locale = profile?.ui_lang === "sq" ? "sq" : profile?.ui_lang === "tr" ? "tr" : fallbackLang;
  (await cookies()).set(LOCALE_COOKIE, uiLang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(afterLoginPath(safeNextPath(next, uiLang), uiLang, !!profile?.age_confirmed_at));
}

/**
 * Email a sign-in link. Creates the account on first use (profile trigger stores ui_lang).
 * Also the "forgot password" path: sign in with a link, then set a new password on the account page.
 *
 * Supabase's built-in emails (no custom SMTP) contain only the link. We send with the implicit flow so the
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
  const { error } = await implicitClient().auth.signInWithOtp({
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

/** Email + password sign-in. Wrong password and unknown email get the same answer. */
export async function signInWithPassword(input: {
  lang: string;
  email: string;
  password: string;
  captchaToken?: string;
  next?: string;
}): Promise<AuthResult> {
  const email = emailSchema.safeParse(input.email);
  const lang = langSchema.safeParse(input.lang);
  const password = passwordSchema.safeParse(input.password);
  if (!email.success || !lang.success) return { ok: false, error: "invalidEmail" };
  if (!password.success) return { ok: false, error: "wrongPassword" };

  // Stop password guessing: per IP and per address (Supabase's captcha and limits apply on top).
  const ip = await clientIp();
  if (!(await checkLimits([["passwordIp", ip], ["passwordEmail", email.data]]))) return { ok: false, error: "tooMany" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
    options: { captchaToken: input.captchaToken || undefined },
  });
  if (error || !data.user) {
    const mapped = mapError(error);
    return { ok: false, error: mapped === "wrongCode" || mapped === "invalidEmail" ? "wrongPassword" : mapped };
  }
  return finishSignIn(data.user.id, lang.data, input.next);
}

/**
 * New account with email + password. Supabase emails a confirmation link; opening it signs the person in
 * (AuthLinkHandler). If the project auto-confirms, the user is signed in at once.
 */
export async function signUp(input: {
  lang: string;
  email: string;
  password: string;
  captchaToken?: string;
  next?: string;
}): Promise<SignUpResult> {
  const email = emailSchema.safeParse(input.email);
  const lang = langSchema.safeParse(input.lang);
  if (!email.success || !lang.success) return { ok: false, error: "invalidEmail" };
  if (typeof input.password !== "string") return { ok: false, error: "tooShort" };
  const problem = passwordProblem(input.password, email.data);
  if (problem) return { ok: false, error: problem };

  // Sign-ups send an email: same limits as sign-in codes.
  const ip = await clientIp();
  if (!(await checkLimits([["sendCodeIp", ip], ["sendCodeEmail", email.data]]))) return { ok: false, error: "tooMany" };

  const next = safeNextPath(input.next, lang.data);
  const { data, error } = await implicitClient().auth.signUp({
    email: email.data,
    password: input.password,
    options: {
      emailRedirectTo: `${await requestOrigin()}/${lang.data}/login?next=${encodeURIComponent(next)}`,
      // password_set: lets the account page say "Change password" (Supabase doesn't expose it).
      data: { ui_lang: lang.data, password_set: true },
      captchaToken: input.captchaToken || undefined,
    },
  });
  if (error) return { ok: false, error: mapError(error) };

  // An existing, confirmed address: Supabase answers with an empty user and sends nothing.
  if (data.user && (data.user.identities?.length ?? 0) === 0) return { ok: false, error: "exists" };

  // Auto-confirm projects return a session right away: store it in our httpOnly cookies.
  if (data.session && data.user) {
    const supabase = await createClient();
    const { error: sessionError } = await supabase.auth.setSession(data.session);
    if (sessionError) return { ok: false, error: "generic" };
    return finishSignIn(data.user.id, lang.data, next);
  }
  return { ok: true, step: "code" };
}

/**
 * A new confirmation link for an account that was created with a password but never confirmed.
 * (A sign-in link would also work, but Supabase then removes the unconfirmed account's password.)
 */
export async function resendConfirmation(input: { lang: string; email: string; captchaToken?: string; next?: string }): Promise<AuthResult> {
  const email = emailSchema.safeParse(input.email);
  const lang = langSchema.safeParse(input.lang);
  if (!email.success || !lang.success) return { ok: false, error: "invalidEmail" };

  const ip = await clientIp();
  if (!(await checkLimits([["sendCodeIp", ip], ["sendCodeEmail", email.data]]))) return { ok: false, error: "tooMany" };

  const next = safeNextPath(input.next, lang.data);
  const { error } = await implicitClient().auth.resend({
    type: "signup",
    email: email.data,
    options: {
      emailRedirectTo: `${await requestOrigin()}/${lang.data}/login?next=${encodeURIComponent(next)}`,
      captchaToken: input.captchaToken || undefined,
    },
  });
  return error ? { ok: false, error: mapError(error) } : { ok: true };
}
