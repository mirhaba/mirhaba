import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { defaultLocale, hasLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { sessionCookieWrites } from "@/lib/supabase/cookies";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

function pickLocale(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (hasLocale(fromCookie)) return fromCookie;

  // Albanian browsers get Albanian; everyone else gets Turkish (the default).
  const accept = request.headers.get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return first === "sq" ? "sq" : defaultLocale;
}

/** Routes that need a fresh session. Everything else (Quick Talk!) never waits on auth. */
const AUTH_ROUTE = /^\/(tr|sq)\/(app|login|translate|checkout)(\/|$)/;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segment = pathname.split("/")[1];

  // The admin dashboard lives outside the locales (/admin) and always needs a fresh session.
  const isAdmin = segment === "admin";

  // 1) Locale prefix: "/" → "/tr", "/foo" → "/tr/foo".
  if (!hasLocale(segment) && !isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = `/${pickLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // The bare start page ("/tr", "/sq") follows the language the person chose on this device. Apps
  // installed before the manifest's start_url became "/" (iPhones keep it) and old bookmarks open
  // "/tr"; without this an Albanian speaker would land in Turkish every time. Deeper links are kept.
  const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
  // Only for real page loads: a router prefetch runs before any click, so redirecting it by the old
  // cookie would get cached and undo the language switch.
  const isPrefetch = request.headers.has("next-router-prefetch");
  if (pathname === `/${segment}` && hasLocale(remembered) && remembered !== segment && !isPrefetch) {
    const url = request.nextUrl.clone();
    url.pathname = `/${remembered}`;
    return NextResponse.redirect(url);
  }

  if (!AUTH_ROUTE.test(pathname) && !isAdmin) return NextResponse.next();

  // 2) Refresh the Supabase session (rotates tokens into httpOnly cookies) and guard routes.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of sessionCookieWrites(cookiesToSet)) response.cookies.set(name, value, options);
        // Auth responses must never be cached by a CDN.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // getUser() asks Supabase to verify the token; never trust the cookie alone.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectKeepingCookies = (to: string) => {
    const redirect = NextResponse.redirect(new URL(to, request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (isAdmin && !user) {
    // Whether this account is an admin (ADMIN_EMAILS) is checked by the admin layout and every action.
    return redirectKeepingCookies(`/${pickLocale(request)}/login?next=${encodeURIComponent(pathname + search)}`);
  }

  const isApp = /^\/(tr|sq)\/(app|checkout)(\/|$)/.test(pathname);
  if (isApp && !user) {
    return redirectKeepingCookies(`/${segment}/login?next=${encodeURIComponent(pathname + search)}`);
  }
  const isLogin = /^\/(tr|sq)\/login(\/|$)/.test(pathname);
  if (isLogin && user) {
    return redirectKeepingCookies(`/${segment}/app`);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Skip Next internals, API routes, metadata/PWA files and anything with an extension.
  matcher: ["/((?!_next|api|monitoring|icons|manifest.webmanifest|sw.js|robots.txt|sitemap.xml|.*\\..*).*)"],
};
