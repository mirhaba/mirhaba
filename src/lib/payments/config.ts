import "server-only";
import { serverEnv } from "@/lib/server-env";

/**
 * RaiAccept settings (all server-only, see .env.example):
 *   RAIACCEPT_USERNAME / RAIACCEPT_PASSWORD  API credentials from the Merchant portal. Sandbox and
 *                                            production use different credentials; the URLs are the same.
 *   RAIACCEPT_MODE                           "sandbox" (default) or "production". Must match the credentials:
 *                                            every RaiAccept answer says `isProduction`, and a payment from the
 *                                            other environment is never accepted.
 *   RAIACCEPT_WEBHOOK_SECRET                 Random string (32+ chars). Signs our notification URLs so only links we
 *                                            created can trigger a status check. Without it no notificationUrl is sent
 *                                            (the return page and Admin → Payments still confirm payments).
 *
 * Sandbox on the live site: only admins (ADMIN_EMAILS) can start a checkout, so nobody gets Premium with a
 * test card. Everyone else keeps seeing "Premium coming soon".
 */

const LIVE = {
  auth: "https://auth.raiaccept.com/auth/api",
  api: "https://trapi.raiaccept.com",
  payment: "https://payment.raiaccept.com",
};

const isVercelProduction = process.env.VERCEL_ENV === "production";

/** Local test doubles may override the URLs, but never on the live site. */
function endpoint(name: string, fallback: string): string {
  const override = serverEnv(name);
  if (!override || isVercelProduction) return fallback;
  return override.replace(/\/+$/, "");
}

export type PaymentsMode = "sandbox" | "production";

export function paymentsConfig() {
  const username = serverEnv("RAIACCEPT_USERNAME");
  const password = serverEnv("RAIACCEPT_PASSWORD");
  const mode: PaymentsMode = serverEnv("RAIACCEPT_MODE") === "production" ? "production" : "sandbox";
  const webhookSecret = serverEnv("RAIACCEPT_WEBHOOK_SECRET");
  return {
    configured: !!username && !!password,
    username: username ?? "",
    password: password ?? "",
    mode,
    /** What `isProduction` must say in every RaiAccept answer we accept. */
    expectProduction: mode === "production",
    webhookSecret: webhookSecret && webhookSecret.length >= 32 ? webhookSecret : null,
    authUrl: endpoint("RAIACCEPT_AUTH_URL", LIVE.auth),
    apiUrl: endpoint("RAIACCEPT_API_URL", LIVE.api),
    /** Payment pages we are willing to send a buyer to. */
    paymentOrigin: endpoint("RAIACCEPT_PAYMENT_ORIGIN", LIVE.payment),
  };
}

/**
 * Who may start a checkout right now: "live" = everyone (production credentials), "test" = this viewer
 * may test with sandbox cards, "off" = nobody (not configured, or sandbox on the live site for non-admins).
 */
export function checkoutAvailability(isAdmin: boolean): "live" | "test" | "off" {
  const config = paymentsConfig();
  if (!config.configured) return "off";
  if (config.mode === "production") return "live";
  return isAdmin || !isVercelProduction ? "test" : "off";
}
