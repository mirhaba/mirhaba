// Shared Sentry settings for browser, server and edge. Privacy first: no IPs, cookies,
// headers or request bodies leave the app; no session replay. Disabled without a DSN.

import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/** Path only: query strings and fragments can hold emails, codes or sign-in tokens. */
const pathOnly = (url: unknown) => (typeof url === "string" ? url.split(/[?#]/)[0] : url);

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
      // Query strings and fragments can hold emails, codes or tokens: keep only the path.
      if (event.request.url) event.request.url = pathOnly(event.request.url) as string;
      delete event.request.query_string;
    }
    if (event.user) event.user = { id: event.user.id }; // never email or IP
    return event;
  },
  // Navigation and fetch breadcrumbs record full URLs (an email sign-in link lands with tokens in #…).
  beforeBreadcrumb(breadcrumb: Breadcrumb) {
    const data = breadcrumb.data;
    if (data) for (const key of ["from", "to", "url"]) if (key in data) data[key] = pathOnly(data[key]);
    return breadcrumb;
  },
};
