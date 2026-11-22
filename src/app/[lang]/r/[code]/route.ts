import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "@/i18n/config";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE } from "@/lib/referral";

/**
 * Invite link: /tr/r/ABCD2345 (a bare /r/ABCD2345 gets the visitor's language from the proxy).
 * Remembers the code in a cookie and opens sign-up. The code is redeemed once the new account
 * gives its first consent (see acceptConsent), never before, so links can't be farmed by visiting.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/[lang]/r/[code]">) {
  const { lang: rawLang, code: rawCode } = await params;
  const lang = hasLocale(rawLang) ? rawLang : "tr";
  const code = rawCode.toUpperCase();
  const valid = /^[A-Z2-9]{8}$/.test(code);

  const response = NextResponse.redirect(new URL(`/${lang}/login?mode=signup${valid ? "&invited=1" : ""}`, request.url));
  if (valid) {
    response.cookies.set(REFERRAL_COOKIE, code, {
      path: "/",
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
    });
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
