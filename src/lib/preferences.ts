"use client";

// Personal preferences, kept on this device (localStorage). They need no account and work
// offline; every read and write fails soft (private mode / blocked storage → defaults).
// The inline script in the root layout (PREFERENCES_BOOT_SCRIPT) applies the visual ones
// (theme, text size, motion) before the first paint, so there is no flash.

import { useSyncExternalStore } from "react";
import { PREFERENCES_KEY as KEY } from "./preferences-boot";
import { DEFAULT_PREFERENCES, sanitizePreferences as sanitize, type Preferences, type SpeechSpeed } from "./preferences-schema";

export {
  DAILY_GOALS,
  DEFAULT_PREFERENCES,
  sanitizePreferences,
  type Direction,
  type Preferences,
  type SpeechSpeed,
  type Theme,
} from "./preferences-schema";

export const SPEECH_RATE: Record<SpeechSpeed, number> = { slow: 0.7, normal: 0.9, fast: 1.1 };

const EVENT = "mirhaba:prefs";

/** First-run guide (language choice + tour) already seen on this device. */
export const GUIDE_SEEN_KEY = "mirhaba.guideSeen";
/** Set by the consent step after the very first sign-in; the welcome screen shows once, then clears it. */
export const WELCOME_PENDING_KEY = "mirhaba.welcomePending";
/** Window event that (re)opens the guide, e.g. from "How to use" in the footer. */
export const OPEN_GUIDE_EVENT = "mirhaba:open-guide";

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

/** When the preferences on this device last changed (ms), for syncing with the account: the newer copy wins. */
const AT_KEY = "mirhaba.prefsAt";
/** Fired after a change made on this device (not after adopting the account's copy), so the sync can push it. */
export const PREFERENCES_CHANGED_EVENT = "mirhaba:prefs-changed";

export function preferencesUpdatedAt(): number {
  const at = Number(storageGet(AT_KEY));
  return Number.isFinite(at) && at > 0 ? at : 0;
}

function write(next: Preferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not remembered, but still applied for this visit.
    cachedRaw = undefined;
    cached = next;
  }
  applyPreferences(next);
  window.dispatchEvent(new Event(EVENT));
}

export function updatePreferences(patch: Partial<Preferences>): Preferences {
  const next = sanitize({ ...readPreferences(), ...patch });
  write(next);
  storageSet(AT_KEY, String(Date.now()));
  window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
  return next;
}

/** Take over the account's copy (it was newer). Keeps its timestamp, so it isn't sent back. */
export function adoptPreferences(raw: unknown, updatedAt: number) {
  write(sanitize(raw));
  storageSet(AT_KEY, String(updatedAt));
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
