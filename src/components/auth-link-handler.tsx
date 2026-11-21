"use client";

import { useEffect } from "react";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Finishes a sign-in that arrives by email link.
 *
 * Supabase's email links go through its /verify endpoint and then land on our site (on the
 * `emailRedirectTo` page, or on the Site URL if that isn't allow-listed). Depending on the flow the
 * landing URL carries:
 *   - `#access_token=…&refresh_token=…`  (implicit flow, what we send) → hand to /api/auth/session
 *   - `?code=…`                           (PKCE, e.g. older links)       → swap it on the server
 *   - `?token_hash=…&type=…`              (custom email templates)       → verify on the server
 *   - `#error=…`                          (expired/used link)            → back to login with a message
 * Mounted in every root layout, so it works wherever the link lands.
 */
export function AuthLinkHandler({ lang }: { lang: "tr" | "sq" }) {
  useEffect(() => {
    const { hash, search, pathname } = window.location;
    const query = new URLSearchParams(search);
    const fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : "");
    const next = safeNextPath(query.get("next"), lang);

    const code = query.get("code");
    const tokenHash = query.get("token_hash");
    if (code || tokenHash) {
      const target = new URLSearchParams({ next, via: "link" });
      if (code) target.set("code", code);
      if (tokenHash) {
        target.set("token_hash", tokenHash);
        target.set("type", query.get("type") ?? "email");
      }
      window.location.replace(`/api/auth/callback?${target}`);
      return;
    }

    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");
    if (accessToken && refreshToken) {
      // Clear the tokens from the address bar right away (history, screenshots, shoulder-surfing).
      window.history.replaceState(null, "", pathname + search);
      fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
      })
        .then((res) => res.ok)
        .catch(() => false)
        .then((ok) => {
          // Full reload so the server renders signed in. /app shows the consent step if needed.
          window.location.replace(ok ? next : `/${lang}/login?error=link&next=${encodeURIComponent(next)}`);
        });
      return;
    }

    if (fragment.get("error") || fragment.get("error_code")) {
      const onLogin = /^\/(tr|sq)\/login/.test(pathname);
      const url = `/${lang}/login?error=link${onLogin ? `&next=${encodeURIComponent(next)}` : ""}`;
      window.location.replace(url);
    }
  }, [lang]);

  return null;
}
