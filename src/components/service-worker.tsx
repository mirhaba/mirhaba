"use client";

import { useEffect } from "react";

/** Registers /sw.js in production and hands it the chunks this page already loaded. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin));
        registration.active?.postMessage({ type: "CACHE_URLS", urls: [location.href, ...urls] });
      })
      .catch(() => {
        // Offline support is a bonus; never break the page over it.
      });
  }, []);

  return null;
}
