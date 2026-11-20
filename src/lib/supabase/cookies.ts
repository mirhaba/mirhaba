import type { CookieOptions } from "@supabase/ssr";

/**
 * Session cookies are httpOnly (JavaScript can't read them, so XSS can't steal a session),
 * Secure in production and SameSite=Lax. @supabase/ssr defaults to readable cookies because
 * its browser client reads them; we only use the browser client to *start* Google sign-in,
 * which doesn't need the session.
 */
export function hardenCookie(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

/**
 * A readable "you are signed in" hint (value "1", nothing else) written next to the session
 * cookies. The session itself stays httpOnly; this only lets offline-first screens (Quick Talk)
 * skip the account sync request for signed-out visitors. Never trusted for access: the
 * server always checks the real session.
 */
export const SIGNED_IN_HINT = "MIRHABA_SIGNED_IN";
const AUTH_TOKEN = /-auth-token(\.\d+)?$/;

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** The session cookies to write (hardened), plus the matching hint (set when signed in, cleared on sign-out). */
export function sessionCookieWrites(cookiesToSet: CookieToSet[]): Required<CookieToSet>[] {
  const hardened = cookiesToSet.map((c) => ({ name: c.name, value: c.value, options: hardenCookie(c.options) }));
  const auth = cookiesToSet.filter((c) => AUTH_TOKEN.test(c.name));
  if (!auth.length) return hardened;
  const signedIn = auth.some((c) => c.value && c.options?.maxAge !== 0);
  const hint: Required<CookieToSet> = {
    name: SIGNED_IN_HINT,
    value: signedIn ? "1" : "",
    options: {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: signedIn ? 400 * 24 * 60 * 60 : 0,
    },
  };
  return [...hardened, hint];
}
