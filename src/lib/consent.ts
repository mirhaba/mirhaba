// Cookie consent, shared by the banner (client), the analytics loader (client) and /api/consent (server).
// The choice lives in a small first-party cookie so we know, before loading anything,
// whether analytics are allowed. The proof of consent is stored in the `consents` table.

export const CONSENT_COOKIE = "MIRHABA_CONSENT";
/** Bump when the cookie policy changes in a way that needs fresh consent: everyone is asked again. */
export const COOKIE_POLICY_VERSION = "2026-11";
/** Ask again after 6 months, even without a policy change. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

export const CONSENT_EVENT = "mirhaba:consent";
export const OPEN_SETTINGS_EVENT = "mirhaba:open-cookie-settings";

export type ConsentChoice = { analytics: boolean };

export function serializeConsent(choice: ConsentChoice): string {
  return `v:${COOKIE_POLICY_VERSION}|a:${choice.analytics ? 1 : 0}`;
}

/** Returns null when there is no valid choice for the current policy version (→ show the banner). */
export function parseConsent(raw: string | undefined | null): ConsentChoice | null {
  if (!raw) return null;
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null; // a malformed cookie (e.g. "%E0") must not crash the page: ask again instead
  }
  const match = /^v:([\w-]+)\|a:([01])$/.exec(value);
  if (!match || match[1] !== COOKIE_POLICY_VERSION) return null;
  return { analytics: match[2] === "1" };
}

/** Client-side read of the consent cookie. */
export function readConsentCookie(): ConsentChoice | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  return parseConsent(raw);
}
