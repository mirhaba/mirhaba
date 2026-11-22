import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkLimit } from "@/lib/rate-limit";
import { isValidWebhookKey, syncPayment } from "@/lib/payments/service";

/**
 * RaiAccept notification webhook.
 *
 * RaiAccept does not sign its webhooks, so the body is never trusted or even read: the notification is
 * only a signal that something changed. The URL carries our payment id and an HMAC of it (only links we
 * created pass), and the status is then fetched from the RaiAccept API with our own credentials
 * (syncPayment), exactly as the RaiAccept docs require.
 *
 * Retries (up to 3, seconds apart) and duplicates are harmless: settlement is idempotent.
 */
const query = z.object({ payment: z.string().uuid(), key: z.string().regex(/^[0-9a-f]{64}$/) });

export async function POST(request: NextRequest) {
  const parsed = query.safeParse({
    payment: request.nextUrl.searchParams.get("payment"),
    key: request.nextUrl.searchParams.get("key"),
  });
  // Unknown or forged link: answer like any missing page.
  if (!parsed.success || !isValidWebhookKey(parsed.data.payment, parsed.data.key)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await checkLimit("paymentWebhook", parsed.data.payment))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  try {
    const result = await syncPayment(parsed.data.payment);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    // RaiAccept unreachable or a mismatch: a 5xx makes RaiAccept retry; the return page and admin re-check too.
    console.error("raiaccept webhook: verification failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
