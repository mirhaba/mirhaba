import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const isDev = process.env.NODE_ENV !== "production";
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
const turnstile = "https://challenges.cloudflare.com";
// PostHog EU: API + lazily loaded extensions. Only contacted after analytics consent.
const posthog = "https://eu.i.posthog.com https://eu-assets.i.posthog.com";

// Inline scripts are needed by Next's static (prerendered) pages; nonce-based CSP would
// force every page to render per request. Revisit when auth pages become dynamic anyway.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${turnstile} https://eu-assets.i.posthog.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  `connect-src 'self' ${supabaseOrigin} ${posthog}${isDev ? " ws:" : ""}`,
  `frame-src ${turnstile}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone only on our own origin (Live Conversation); everything else off.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // One URL per language for the dictionary (SEO): wrong-language paths and the old /dictionary redirect.
  async redirects() {
    return [
      { source: "/tr/dictionary/:path*", destination: "/tr/argo/:path*", permanent: true },
      { source: "/sq/dictionary/:path*", destination: "/sq/zhargon/:path*", permanent: true },
      { source: "/sq/argo/:path*", destination: "/sq/zhargon/:path*", permanent: true },
      { source: "/tr/zhargon/:path*", destination: "/tr/argo/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The service worker must never be cached by the browser, or updates get stuck.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

// Sentry: source maps are uploaded only when SENTRY_AUTH_TOKEN is set (Vercel build env).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  telemetry: false,
});
