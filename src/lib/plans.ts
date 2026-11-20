// Free vs paid limits (see "Free vs paid" in the build plan). Server-enforced.

/** Free accounts: a few text translations per day (Kosovo calendar day). */
export const FREE_TEXT_TRANSLATIONS_PER_DAY = 5;
/** Paid: "unlimited (fair use)". High enough no real person hits it; stops scripted abuse. */
export const PAID_TEXT_TRANSLATIONS_PER_DAY = 300;

/** Longest text accepted in one translation. */
export const MAX_TRANSLATION_CHARS = 1000;

/**
 * Prices shown on the pricing page and seeded into `plans` (EUR, VAT included).
 * Change them here only: scripts/generate-seed.ts reads the same values.
 */
export const PLANS = [
  { id: "monthly", interval: "month", priceEur: 5.99 },
  { id: "yearly", interval: "year", priceEur: 57.5 },
] as const;

/** Yearly saving vs 12 × monthly, rounded (≈ 20%). */
export const YEARLY_SAVING_PERCENT = Math.round((1 - PLANS[1].priceEur / (PLANS[0].priceEur * 12)) * 100);
