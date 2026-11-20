// Shared Sentry settings for browser, server and edge. Privacy first: no IPs, cookies,
// headers or request bodies leave the app; no session replay. Disabled without a DSN.

import type { ErrorEvent } from "@sentry/nextjs";

export const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryBaseOptions = {
  dsn: sentryDsn,
  enabled: !!sentryDsn,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development",
  sendDefaultPii: false,
  // 10% of requests get performance traces in production; errors are always captured.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  beforeSend(event: ErrorEvent) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.data;
      // Query strings can hold emails or codes (?next=…): keep only the path.
      if (event.request.url) event.request.url = event.request.url.split("?")[0];
      delete event.request.query_string;
    }
    if (event.user) event.user = { id: event.user.id }; // never email or IP
    return event;
  },
};
