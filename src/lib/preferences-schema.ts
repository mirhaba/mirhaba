// Preference shapes and validation, shared by the browser store (preferences.ts) and the server
// action that syncs them with the account. No "use client": both sides import it.

export type Direction = "tr-sq" | "sq-tr";
export type Theme = "system" | "light" | "dark";
export type SpeechSpeed = "slow" | "normal" | "fast";

export type Preferences = {
  /** Who is learning what: a Turkish speaker learning Albanian (default) or the other way round. */
  direction: Direction;
  theme: Theme;
  /** Slightly larger text everywhere. */
  largeText: boolean;
  /** Turn off animations even if the OS doesn't ask for it. */
  reduceMotion: boolean;
  /** Speed of the device voice when a phrase is read aloud. */
  speechSpeed: SpeechSpeed;
  /** Show the Turkish-style reading under Albanian text ("Faleminderit" → "fa-le-min-de-rit"). */
  showReading: boolean;
  /** Lessons per day the person wants to finish. */
  dailyGoal: number;
  /** Optional first name for the greeting. Never leaves the device. */
  nickname: string;
};

export const DEFAULT_PREFERENCES: Preferences = {
  direction: "tr-sq",
  theme: "system",
  largeText: false,
  reduceMotion: false,
  speechSpeed: "normal",
  showReading: true,
  dailyGoal: 1,
  nickname: "",
};

export const DAILY_GOALS = [1, 2, 3, 5] as const;

/** Anything (localStorage, the account, a request) → valid preferences; unknown values fall back to defaults. */
export function sanitizePreferences(raw: unknown): Preferences {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Preferences, unknown>>;
  const pick = <T,>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  return {
    direction: pick(p.direction, ["tr-sq", "sq-tr"] as const, DEFAULT_PREFERENCES.direction),
    theme: pick(p.theme, ["system", "light", "dark"] as const, DEFAULT_PREFERENCES.theme),
    largeText: typeof p.largeText === "boolean" ? p.largeText : DEFAULT_PREFERENCES.largeText,
    reduceMotion: typeof p.reduceMotion === "boolean" ? p.reduceMotion : DEFAULT_PREFERENCES.reduceMotion,
    speechSpeed: pick(p.speechSpeed, ["slow", "normal", "fast"] as const, DEFAULT_PREFERENCES.speechSpeed),
    showReading: typeof p.showReading === "boolean" ? p.showReading : DEFAULT_PREFERENCES.showReading,
    dailyGoal: pick(p.dailyGoal, DAILY_GOALS, DEFAULT_PREFERENCES.dailyGoal as (typeof DAILY_GOALS)[number]),
    nickname: typeof p.nickname === "string" ? p.nickname.slice(0, 40) : "",
  };
}
