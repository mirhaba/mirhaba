// Browser error tracking (Sentry). No cookies, no session replay, no IPs (see sentry-options).
//
// Speed first: Sentry is ~130 KB gzipped, so it is NOT in the first-load bundle.
// It is downloaded only when a DSN is configured, after the page is idle, so Quick Talk
// renders and responds before it. (Errors in the first idle moment are not reported.)
// Browser performance tracing is off; server-side traces still run (instrumentation.ts).

if (process.env.NEXT_PUBLIC_SENTRY_DSN && typeof window !== "undefined") {
  const start = () => {
    void Promise.all([import("@sentry/nextjs"), import("@/lib/sentry-options")]).then(([Sentry, { sentryBaseOptions }]) => {
      Sentry.init({
        ...sentryBaseOptions,
        tracesSampleRate: 0,
        // Reports go through our own /monitoring route (next.config.ts): no outside domain in the CSP,
        // and ad blockers don't drop them.
      });
    });
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 2000);
}
