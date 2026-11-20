/**
 * Public base URL. Order: explicit NEXT_PUBLIC_SITE_URL → Vercel's production domain →
 * this deployment's Vercel URL (previews) → localhost.
 */
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const siteUrl = resolveSiteUrl();

/** Preview/development deployments must never be indexed by search engines. */
export const isIndexable = !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production";

/** The dictionary lives at a localized, search-friendly path: /tr/argo, /sq/zhargon. */
export const DICTIONARY_SEGMENT = { tr: "argo", sq: "zhargon" } as const;

export function dictionaryPath(lang: "tr" | "sq", slug?: string): string {
  return `/${lang}/${DICTIONARY_SEGMENT[lang]}${slug ? `/${slug}` : ""}`;
}

/** Top-level sections. Paths are relative to `/[lang]`. */
export const sections = {
  quickTalk: "",
  translate: "/translate",
  learn: "/learn",
  dictionary: "/dictionary", // resolved per language by sectionHref()
} as const;

export function sectionHref(key: keyof typeof sections, lang: "tr" | "sq"): string {
  return key === "dictionary" ? dictionaryPath(lang) : `/${lang}${sections[key]}`;
}

export const legalPages = ["privacy", "terms", "refunds", "cookies", "contact"] as const;
export type LegalPage = (typeof legalPages)[number];
