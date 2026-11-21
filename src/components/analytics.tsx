"use client";

import { useEffect } from "react";
import type { PostHog } from "posthog-js";
import { CONSENT_EVENT, readConsentCookie, type ConsentChoice } from "@/lib/consent";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let instance: PostHog | null = null;

/** Sign-in links carry tokens and codes in the URL: never send those to analytics. */
const SECRET_PARAMS = ["code", "token", "token_hash", "access_token", "refresh_token", "error_description"];
export function scrubUrl(value: unknown): unknown {
  if (typeof value !== "string" || !value) return value;
  try {
    const url = new URL(value);
    if (!url.origin.startsWith(location.origin) && url.pathname.includes("/auth/")) return url.origin; // e.g. Supabase /auth/v1/verify
    url.hash = "";
    for (const key of SECRET_PARAMS) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return value;
  }
}

/** Loads PostHog (EU) only after the visitor accepted analytics. The library isn't even downloaded before. */
async function start() {
  if (!KEY) return;
  if (instance) {
    instance.opt_in_capturing();
    return;
  }
  const { default: posthog } = await import("posthog-js");
  posthog.init(KEY, {
    api_host: HOST,
    defaults: "2025-11-30",
    capture_pageview: "history_change", // App Router navigations
    person_profiles: "identified_only",
    disable_session_recording: true,
    disable_surveys: true,
    autocapture: true,
    mask_all_text: true, // never send phrase text or typed content
    mask_all_element_attributes: true,
    respect_dnt: true,
    before_send: (event) => {
      if (event?.properties) {
        for (const key of ["$current_url", "$referrer", "$initial_referrer"]) {
          if (key in event.properties) event.properties[key] = scrubUrl(event.properties[key]);
        }
      }
      return event;
    },
  });
  instance = posthog;
}

/** Withdrawal: stop capturing and remove PostHog's cookies and storage. */
function stop() {
  if (instance) {
    instance.opt_out_capturing();
    instance.reset();
  }
  for (const name of document.cookie.split("; ").map((c) => c.split("=")[0])) {
    if (name.startsWith("ph_")) document.cookie = `${name}=; path=/; max-age=0`;
  }
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("ph_")) localStorage.removeItem(key);
  } catch {
    /* storage blocked */
  }
}

export function Analytics() {
  useEffect(() => {
    if (readConsentCookie()?.analytics) void start();
    const onChoice = (e: Event) => {
      if ((e as CustomEvent<ConsentChoice>).detail.analytics) void start();
      else stop();
    };
    window.addEventListener(CONSENT_EVENT, onChoice);
    return () => window.removeEventListener(CONSENT_EVENT, onChoice);
  }, []);
  return null;
}
