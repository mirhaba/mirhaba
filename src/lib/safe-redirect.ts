import { defaultLocale, hasLocale, type Locale } from "@/i18n/config";

/**
 * Only allow redirects to our own paths ("/tr/app"), never to another site
 * ("//evil.com", "https://evil.com", "/\\evil.com"). Falls back to the account page.
 */
export function safeNextPath(next: string | null | undefined, lang: Locale = defaultLocale): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\r\n]/.test(next)) {
    return `/${lang}/app`;
  }
  return next;
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
