import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { afterLoginPath, localeOfPath, safeNextPath } from "@/lib/safe-redirect";

/**
 * Google sign-in (and PKCE email links) land here with a one-time `code`; custom email templates
 * may send a `token_hash` instead. We swap either for a session (httpOnly cookies) and continue to
 * `next` in the user's saved language.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const lang = localeOfPath(next);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const fail = () =>
    NextResponse.redirect(new URL(`/${lang}/login?error=${tokenHash || searchParams.get("via") === "link" ? "link" : "oauth"}&next=${encodeURIComponent(next)}`, origin));
  if (!code && !tokenHash) return fail();

  const supabase = await createClient();
  const { data, error } = tokenHash
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type === "signup" || type === "magiclink" ? type : "email" })
    : await supabase.auth.exchangeCodeForSession(code!);
  if (error || !data.user) return fail();

  const { data: profile } = await supabase.from("profiles").select("ui_lang, age_confirmed_at").eq("id", data.user.id).single();
  const uiLang: Locale = profile?.ui_lang === "sq" ? "sq" : profile?.ui_lang === "tr" ? "tr" : lang;

  const response = NextResponse.redirect(new URL(afterLoginPath(next, uiLang, !!profile?.age_confirmed_at), origin));
  response.cookies.set(LOCALE_COOKIE, uiLang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
