"use client";

// Personal preferences, kept on this device (localStorage). They need no account and work
// offline; every read and write fails soft (private mode / blocked storage → defaults).
// The inline script in the root layout (PREFERENCES_BOOT_SCRIPT) applies the visual ones
// (theme, text size, motion) before the first paint, so there is no flash.

import { useSyncExternalStore } from "react";
import { PREFERENCES_KEY as KEY } from "./preferences-boot";

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
export const SPEECH_RATE: Record<SpeechSpeed, number> = { slow: 0.7, normal: 0.9, fast: 1.1 };

const EVENT = "mirhaba:prefs";

/** First-run guide (language choice + tour) already seen on this device. */
export const GUIDE_SEEN_KEY = "mirhaba.guideSeen";
/** Set by the consent step after the very first sign-in; the welcome screen shows once, then clears it. */
export const WELCOME_PENDING_KEY = "mirhaba.welcomePending";
/** Window event that (re)opens the guide, e.g. from "How to use" in the footer. */
export const OPEN_GUIDE_EVENT = "mirhaba:open-guide";

function sanitize(raw: unknown): Preferences {
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

let cachedRaw: string | null | undefined;
let cached: Preferences = DEFAULT_PREFERENCES;

export function readPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    cached = sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    cached = DEFAULT_PREFERENCES;
  }
  return cached;
}

/** Applies the visual preferences to <html> (same logic as the boot script). */
export function applyPreferences(p: Preferences) {
  const root = document.documentElement;
  if (p.theme === "system") delete root.dataset.theme;
  else root.dataset.theme = p.theme;
  if (p.largeText) root.dataset.text = "large";
  else delete root.dataset.text;
  if (p.reduceMotion) root.dataset.motion = "reduce";
  else delete root.dataset.motion;
}

export function updatePreferences(patch: Partial<Preferences>): Preferences {
  const next = sanitize({ ...readPreferences(), ...patch });
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not remembered, but still applied for this visit.
    cachedRaw = undefined;
    cached = next;
  }
  applyPreferences(next);
  window.dispatchEvent(new Event(EVENT));
  return next;
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      applyPreferences(readPreferences());
      onChange();
    }
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage); // another tab changed them
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Live preferences. The server render (and the first client render) use the defaults. */
export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, readPreferences, () => DEFAULT_PREFERENCES);
}

export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* not remembered */
  }
}
