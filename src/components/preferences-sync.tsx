"use client";

import { useEffect } from "react";
import { SIGNED_IN_HINT } from "@/lib/supabase/cookies";
import { adoptPreferences, preferencesUpdatedAt, PREFERENCES_CHANGED_EVENT, readPreferences, storageGet, storageSet } from "@/lib/preferences";

/** The account this phone last synced its preferences with. */
const ACCOUNT_KEY = "mirhaba.prefsAccount";

const looksSignedIn = () => document.cookie.split("; ").includes(`${SIGNED_IN_HINT}=1`);

/**
 * Keeps the dashboard preferences in step with the account (signed in only): once after the page
 * is idle, and a moment after every change. Offline or signed out it does nothing; the
 * preferences simply stay on this phone and sync next time.
 */
export function PreferencesSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;

    const sync = async () => {
      if (running || !looksSignedIn()) return;
      running = true;
      try {
        const { syncPreferences } = await import("@/lib/preferences-sync-action");
        const result = await syncPreferences({
          prefs: readPreferences(),
          updatedAt: preferencesUpdatedAt(),
          account: storageGet(ACCOUNT_KEY),
        });
        if (result.signedIn && result.ok) {
          if (result.prefs) adoptPreferences(result.prefs, result.updatedAt);
          storageSet(ACCOUNT_KEY, result.account);
        }
      } catch {
        /* offline: try again next time */
      } finally {
        running = false;
      }
    };

    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(sync, 1200);
    };

    const first = setTimeout(() => {
      if ("requestIdleCallback" in window) requestIdleCallback(() => void sync(), { timeout: 4000 });
      else void sync();
    }, 1500);
    window.addEventListener(PREFERENCES_CHANGED_EVENT, soon);
    window.addEventListener("online", soon);
    return () => {
      clearTimeout(first);
      clearTimeout(timer);
      window.removeEventListener(PREFERENCES_CHANGED_EVENT, soon);
      window.removeEventListener("online", soon);
    };
  }, []);

  return null;
}
