// Server + edge error tracking (Sentry). Runs once per server instance.
import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/sentry-options";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sentryBaseOptions);
  }
}

// Errors thrown in Server Components, Route Handlers, Server Actions and the proxy.
export const onRequestError = Sentry.captureRequestError;
