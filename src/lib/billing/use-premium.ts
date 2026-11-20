"use client";

import { useEffect, useState } from "react";
import { getDB } from "@/lib/offline-db";
import { SIGNED_IN_HINT } from "@/lib/supabase/cookies";
import { getPremiumStatus } from "./status-action";

const KEY = "premium";
type Cached = { until: number };

const looksSignedIn = () => document.cookie.split("; ").includes(`${SIGNED_IN_HINT}=1`);

async function readCached(): Promise<boolean> {
  try {
    const row = await getDB().meta.get(KEY);
    return ((row?.value as Cached | undefined)?.until ?? 0) > Date.now();
  } catch {
    return false;
  }
}

async function writeCached(until: number | null) {
  try {
    if (until) await getDB().meta.put({ key: KEY, value: { until } satisfies Cached });
    else await getDB().meta.delete(KEY);
  } catch {
    // storage blocked: just not remembered
  }
}

/**
 * Premium status for UI only (which lessons show a lock, what the pricing card says).
 * Shows the last known answer from this device at once (so it also works offline), then
 * asks the server if the visitor looks signed in. Signed-out visitors never send a request.
 * Real access is always decided on the server (`getEntitlement`).
 *
 * Returns null while unknown.
 */
export function usePremium(): boolean | null {
  const [premium, setPremium] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const set = (value: boolean) => {
      if (!cancelled) setPremium(value);
    };

    void (async () => {
      if (!looksSignedIn()) {
        await writeCached(null);
        return set(false);
      }
      set(await readCached());
      try {
        const status = await getPremiumStatus();
        await writeCached(status.premium && status.activeUntil ? Date.parse(status.activeUntil) : null);
        set(status.premium);
      } catch {
        // offline: keep the cached answer
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return premium;
}
