/**
 * Public base URL. Order: explicit NEXT_PUBLIC_SITE_URL → Vercel's production domain →
 * this deployment's Vercel URL (previews) → localhost.
 */
function resolveSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined,
    process.env.VERCEL_URL,
  ];
  for (const candidate of candidates) {
    const url = toOrigin(candidate);
    if (url) return url;
  }
  return "http://localhost:3000";
}

/**
 * Accepts values pasted into a dashboard in any common form ("mirhaba.app", " https://x.com/ ",
 * "\"https://x.com\"") and returns a clean origin, or null if it still isn't a valid URL.
 */
function toOrigin(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/^["']|["']$/g, "").trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    console.warn(`[site] Ignoring invalid site URL: ${JSON.stringify(raw)}`);
    return null;
  }
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
