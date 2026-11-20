// Shared locale config. Safe to import from proxy, server and client code.

export const locales = ["tr", "sq"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "tr";

/** Cookie that remembers the user's interface language. */
export const LOCALE_COOKIE = "MIRHABA_LOCALE";

export function hasLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** BCP-47 tags used for Intl (dates, numbers, case mapping). */
export const intlLocale: Record<Locale, string> = {
  tr: "tr-TR",
  sq: "sq-XK",
};
