import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Locale } from "@/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { paymentsConfig } from "./config";
import {
  createOrder,
  createPaymentSession,
  getOrder,
  getOrderTransactions,
  RaiAcceptError,
  refundTransaction,
  type OrderInput,
} from "./raiaccept";

export type PlanId = "monthly" | "yearly";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

const cents = (n: number) => Math.round(n * 100);

// ---------- Signed notification links ----------
/** HMAC of the payment id: only notification URLs we created can trigger a status check. */
export function webhookKey(paymentId: string): string | null {
  const secret = paymentsConfig().webhookSecret;
  return secret ? createHmac("sha256", secret).update(`raiaccept-webhook:${paymentId}`).digest("hex") : null;
}

export function isValidWebhookKey(paymentId: string, key: string | null): boolean {
  const expected = webhookKey(paymentId);
  if (!expected || !key || key.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(expected));
}

// ---------- Start a checkout ----------
export class CheckoutError extends Error {}

/**
 * Creates our payment row (price from `plans`), the RaiAccept order and its payment session.
 * Returns the RaiAccept payment page URL to send the buyer to.
 */
export async function startCheckout(input: {
  userId: string;
  email: string | undefined;
  plan: PlanId;
  lang: Locale;
  origin: string;
  ip: string | null;
}): Promise<{ paymentId: string; redirectUrl: string }> {
  const config = paymentsConfig();
  if (!config.configured) throw new CheckoutError("payments not configured");
  const db = createAdminClient();

  // merchantOrderReference: unique per attempt, only A-Z a-z 0-9 - _ (RaiAccept rule).
  const reference = `MH-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`.toUpperCase();
  const { data: created, error } = await db.rpc("create_payment", { p_user: input.userId, p_plan: input.plan, p_reference: reference }).single();
  if (error || !created) throw new CheckoutError(`create_payment failed: ${error?.message}`);
  const { id: paymentId, amount } = created as { id: string; amount: number; currency: string };

  const back = (result: "success" | "fail" | "cancel") =>
    `${input.origin}/${input.lang}/checkout/return?payment=${paymentId}&result=${result}`;
  const key = webhookKey(paymentId);
  const order: OrderInput = {
    merchantOrderReference: reference,
    amount: Number(amount),
    currency: "EUR",
    description: input.plan === "monthly" ? "Mirhaba Premium - 1 month" : "Mirhaba Premium - 1 year",
    itemDescription: input.plan === "monthly" ? "Premium 1 month" : "Premium 1 year",
    consumer: {
      // Recommended by RaiAccept: helps the bank approve without an extra 3-D Secure step.
      ...(input.email ? { email: input.email.slice(0, 255) } : {}),
      ...(input.ip && input.ip !== "unknown" ? { ipAddress: input.ip.slice(0, 255) } : {}),
    },
    urls: {
      successUrl: back("success"),
      failUrl: back("fail"),
      cancelUrl: back("cancel"),
      ...(key ? { notificationUrl: `${input.origin}/api/payments/raiaccept/webhook?payment=${paymentId}&key=${key}` } : {}),
    },
    customerReference: input.userId,
  };

  try {
    const created = await createOrder(order);
    if (created.isProduction !== undefined && created.isProduction !== config.expectProduction) {
      throw new CheckoutError(
        `RaiAccept credentials are for ${created.isProduction ? "production" : "sandbox"} but RAIACCEPT_MODE is ${config.mode}`,
      );
    }
    // Without the order id the payment could never be verified: stop before the buyer can pay.
    const { error: saveError } = await db.from("payments").update({ raiaccept_order_id: created.orderIdentification }).eq("id", paymentId);
    if (saveError) throw new CheckoutError(`could not save the RaiAccept order id: ${saveError.message}`);
    const session = await createPaymentSession(created.orderIdentification, order);

    // Only ever send the buyer to RaiAccept's own payment page.
    const url = new URL(session.paymentRedirectURL);
    if (url.origin !== new URL(config.paymentOrigin).origin) throw new CheckoutError(`unexpected payment page ${url.origin}`);
    // The payment form has Albanian but no Turkish (English is the closest for Turkish speakers).
    url.searchParams.set("preferredLocale", input.lang === "sq" ? "sq" : "en");
    return { paymentId, redirectUrl: url.toString() };
  } catch (error) {
    await db.from("payments").update({ status: "failed", raiaccept_status: "CHECKOUT_ERROR" }).eq("id", paymentId).eq("status", "pending");
    throw error instanceof CheckoutError ? error : new CheckoutError(error instanceof Error ? error.message : String(error));
  }
}

// ---------- Verify with RaiAccept and settle ----------
export type SyncResult = { status: PaymentStatus; statusCode: string | null; premiumUntil: string | null; changed: boolean };

type PaymentRow = {
  id: string;
  user_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  reference: string | null;
  raiaccept_order_id: string | null;
  raiaccept_transaction_id: string | null;
  status_code: string | null;
};

const PAYMENT_COLUMNS = "id, user_id, amount, currency, status, reference, raiaccept_order_id, raiaccept_transaction_id, status_code";

/**
 * Asks RaiAccept for the order and applies the verified status. Safe to call any number of times and
 * from anywhere (webhook, return page, admin): `settle_payment` locks the row and grants Premium once.
 */
export async function syncPayment(paymentId: string): Promise<SyncResult> {
  const config = paymentsConfig();
  const db = createAdminClient();
  const { data: row } = await db.from("payments").select(PAYMENT_COLUMNS).eq("id", paymentId).maybeSingle<PaymentRow>();
  if (!row) throw new RaiAcceptError("unknown payment");
  const unchanged: SyncResult = { status: row.status, statusCode: row.status_code, premiumUntil: null, changed: false };
  if (!row.raiaccept_order_id || !config.configured) return unchanged;

  const order = await getOrder(row.raiaccept_order_id);

  // Everything must match what we created; otherwise nothing is applied.
  if (order.orderIdentification !== row.raiaccept_order_id) throw new RaiAcceptError("order id mismatch");
  if (order.invoice.merchantOrderReference !== row.reference) throw new RaiAcceptError("order reference mismatch");
  if (cents(order.invoice.amount) !== cents(Number(row.amount)) || order.invoice.currency.toUpperCase() !== row.currency) {
    throw new RaiAcceptError(`amount mismatch on ${row.id}: ${order.invoice.amount} ${order.invoice.currency}`);
  }
  if (order.isProduction !== config.expectProduction) {
    // A sandbox (test card) order must never count on a production setup, or the other way round.
    throw new RaiAcceptError(`environment mismatch on ${row.id}: isProduction=${order.isProduction}, mode=${config.mode}`);
  }

  // The purchase transaction: its id is needed for refunds, its code explains a decline.
  let transactionId: string | null = null;
  let statusCode: string | null = null;
  if (order.status !== "DRAFT" && order.status !== "CHECKOUT") {
    try {
      const purchases = (await getOrderTransactions(row.raiaccept_order_id)).filter((t) => (t.transactionType ?? "PURCHASE") === "PURCHASE");
      const success = purchases.find((t) => t.status === "SUCCESS");
      const last = success ?? purchases.at(-1);
      transactionId = success?.transactionId ?? null;
      statusCode = last?.statusCode ?? null;
    } catch (error) {
      // Not fatal: the order status alone is authoritative. The transaction is looked up again for a refund.
      console.warn("raiaccept transactions lookup failed", error instanceof Error ? error.message : error);
    }
  }

  const { data, error } = await db.rpc("settle_payment", {
    p_payment: row.id,
    p_order_id: row.raiaccept_order_id,
    p_order_status: order.status,
    p_amount: order.invoice.amount,
    p_currency: order.invoice.currency,
    p_is_production: order.isProduction,
    p_transaction_id: transactionId,
    p_status_code: statusCode,
  });
  if (error) throw new RaiAcceptError(`settle_payment failed: ${error.message}`);
  const result = data as { status: PaymentStatus; activated: boolean; premium_until: string | null };
  return { status: result.status, statusCode: statusCode ?? row.status_code, premiumUntil: result.premium_until, changed: result.status !== row.status };
}

/**
 * Re-checks this user's recent unconfirmed payments (e.g. the buyer closed the tab before coming back and
 * the webhook never arrived). Cheap no-op when there are none.
 */
export async function syncRecentPendingPayments(userId: string): Promise<void> {
  const db = createAdminClient();
  const { data } = await db
    .from("payments")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .not("raiaccept_order_id", "is", null)
    .gt("created_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(3);
  await Promise.all(
    (data ?? []).map((p) =>
      syncPayment(p.id).catch((error) => console.warn("pending payment re-check failed", error instanceof Error ? error.message : error)),
    ),
  );
}

// ---------- Refunds (admin) ----------
export class RefundError extends Error {}

/** Full refund of one payment. Claimed atomically first, so it can never be sent twice. */
export async function refundPayment(paymentId: string, revokePremium: boolean): Promise<{ refundTransactionId: string }> {
  const db = createAdminClient();
  const { data: row } = await db.from("payments").select(PAYMENT_COLUMNS).eq("id", paymentId).maybeSingle<PaymentRow>();
  if (!row || !row.raiaccept_order_id) throw new RefundError("Unknown payment.");
  if (row.status !== "succeeded") throw new RefundError(`Only successful payments can be refunded (this one is ${row.status}).`);

  const { data: claimed } = await db.rpc("claim_refund", { p_payment: paymentId });
  if (!claimed) throw new RefundError("A refund for this payment was already requested.");

  let sent = false;
  try {
    let transactionId = row.raiaccept_transaction_id;
    if (!transactionId) {
      const success = (await getOrderTransactions(row.raiaccept_order_id)).find(
        (t) => (t.transactionType ?? "PURCHASE") === "PURCHASE" && t.status === "SUCCESS",
      );
      transactionId = success?.transactionId ?? null;
    }
    if (!transactionId) throw new RefundError("RaiAccept has no successful purchase for this order.");
    const refund = await refundTransaction(row.raiaccept_order_id, transactionId, Number(row.amount), row.currency);
    sent = true;
    if (revokePremium) await db.rpc("revoke_payment_period", { p_payment: paymentId });
    // RaiAccept may take a moment to mark the order FULLY_REFUNDED; the webhook / next check records it.
    await syncPayment(paymentId).catch(() => {});
    return { refundTransactionId: refund.transactionId };
  } catch (error) {
    // Only a refund that was NOT sent may be retried; once the money is on its way the claim stays.
    if (!sent) await db.rpc("release_refund_claim", { p_payment: paymentId });
    const message = error instanceof Error ? error.message : "Refund failed.";
    throw new RefundError(sent ? `Refund was sent, but a follow-up step failed: ${message}` : message);
  }
}
