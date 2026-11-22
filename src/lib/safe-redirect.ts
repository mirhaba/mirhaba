import { defaultLocale, hasLocale, type Locale } from "@/i18n/config";

/**
 * Only allow redirects to our own paths ("/tr/app"), never to another site
 * ("//evil.com", "https://evil.com", "/\\evil.com", "/\t/evil.com"). Falls back to the account page.
 *
 * Browsers silently drop tabs and newlines from URLs, so "/\t/evil.com" would become "//evil.com":
 * any whitespace or control character is refused, and the result must still resolve to our origin.
 */
export function safeNextPath(next: string | null | undefined, lang: Locale = defaultLocale): string {
  const fallback = `/${lang}/app`;
  if (!next || next.length > 2048 || !next.startsWith("/") || next.startsWith("//") || /[\\\s\u0000-\u001f\u007f]/.test(next)) {
    return fallback;
  }
  try {
    const probe = new URL(next, "https://origin.invalid");
    if (probe.origin !== "https://origin.invalid") return fallback;
    return probe.pathname + probe.search + probe.hash;
  } catch {
    return fallback;
  }
}

/** Replace the locale segment of an internal path. */
export function withLocale(path: string, lang: Locale): string {
  if (/^\/admin(\/|\?|$)/.test(path)) return path; // the admin dashboard has no locale
  const rest = path.replace(/^\/(tr|sq)(?=\/|$)/, "");
  return `/${lang}${rest}`;
}

export function localeOfPath(path: string): Locale {
  const segment = path.split("/")[1];
  return hasLocale(segment) ? segment : defaultLocale;
}

/**
 * Where to send someone right after signing in. Users who haven't given the one-time
 * consent (16+, terms, privacy) go to the account page first, then on to `next`.
 */
export function afterLoginPath(next: string, lang: Locale, consented: boolean): string {
  const target = withLocale(next, lang);
  if (consented) return target;
  const app = `/${lang}/app`;
  return target === app ? app : `${app}?next=${encodeURIComponent(target)}`;
}
