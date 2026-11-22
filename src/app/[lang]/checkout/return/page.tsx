import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CircleCheck, CircleX, Clock, RotateCcw } from "lucide-react";
import { z } from "zod";
import { hasLocale, intlLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Messages } from "@/i18n/dictionaries";
import { fill } from "@/lib/format";
import { declineReason } from "@/lib/payments/reasons";
import { syncPayment } from "@/lib/payments/service";
import { checkLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { StateView } from "@/components/state-view";
import { PendingRefresh } from "./pending-refresh";

export async function generateMetadata({ params }: PageProps<"/[lang]/checkout/return">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = await getDictionary(lang);
  return { title: t.checkout.title, robots: { index: false, follow: false } };
}

/**
 * Where RaiAccept sends the buyer back. The `result` in the URL is only a hint the buyer could edit:
 * the page always asks RaiAccept for the real status (syncPayment) before saying anything.
 */
export default async function CheckoutReturnPage({ params, searchParams }: PageProps<"/[lang]/checkout/return">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return (
    <div className="mx-auto max-w-md">
      <Suspense fallback={<StateView Icon={Clock} title={t.checkout.pendingTitle} body={t.checkout.pendingBody} />}>
        <PaymentResult lang={lang} t={t} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Row = {
  id: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  status_code: string | null;
  raiaccept_status: string | null;
  raiaccept_order_id: string | null;
  subscription_id: string | null;
};

async function PaymentResult({
  lang,
  t,
  searchParams,
}: {
  lang: Locale;
  t: Messages;
  searchParams: PageProps<"/[lang]/checkout/return">["searchParams"];
}) {
  const c = t.checkout;
  const paymentId = z.string().uuid().safeParse((await searchParams).payment);
  if (!paymentId.success) notFound();

  const user = await getUser();
  if (!user) redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/checkout/return?payment=${paymentId.data}`)}`);

  const db = createAdminClient();
  const load = async () =>
    (
      await db
        .from("payments")
        .select("id, status, status_code, raiaccept_status, raiaccept_order_id, subscription_id")
        .eq("id", paymentId.data)
        .eq("user_id", user.id) // only the buyer may see their payment
        .maybeSingle<Row>()
    ).data;

  let payment = await load();
  if (!payment) notFound();

  // Still open: ask RaiAccept now (the webhook may not have arrived yet, or can't reach this host).
  if (payment.status === "pending" && payment.raiaccept_order_id && (await checkLimit("paymentCheckUser", user.id))) {
    try {
      await syncPayment(payment.id);
      payment = (await load()) ?? payment;
    } catch (error) {
      console.error("checkout return: status check failed", error instanceof Error ? error.message : error);
    }
  }

  const pricing = `/${lang}/pricing`;

  if (payment.status === "succeeded") {
    const { data: sub } = payment.subscription_id
      ? await db.from("subscriptions").select("current_period_end").eq("id", payment.subscription_id).maybeSingle()
      : { data: null };
    const date = sub?.current_period_end
      ? new Intl.DateTimeFormat(intlLocale[lang], { dateStyle: "long" }).format(new Date(sub.current_period_end))
      : "";
    return (
      <StateView
        Icon={CircleCheck}
        tone="error" /* accent tile */
        title={c.successTitle}
        body={date ? fill(c.successBody, { date }) : undefined}
        action={
          <div className="flex flex-col items-center gap-2">
            <a href={`/${lang}/translate`} className="pressable inline-flex h-12 items-center rounded-full bg-accent px-6 font-semibold text-on-accent hover:bg-accent-pressed">
              {c.startUsing}
            </a>
            <a href={`/${lang}/app`} className="inline-flex h-11 items-center px-3 text-[15px] font-medium text-accent-text">
              {c.toAccount}
            </a>
          </div>
        }
      />
    );
  }

  if (payment.status === "refunded") {
    return <StateView Icon={RotateCcw} title={c.refundedTitle} body={c.refundedBody} action={{ label: c.toAccount, href: `/${lang}/app` }} />;
  }

  if (payment.status === "failed") {
    const canceled = payment.raiaccept_status === "CANCELED" || payment.raiaccept_status === "ABANDONED";
    const reason = canceled ? null : declineReason(payment.status_code);
    return (
      <StateView
        Icon={CircleX}
        tone="error"
        title={canceled ? c.canceledTitle : c.failedTitle}
        body={canceled ? c.canceledBody : [reason ? c.reasons[reason] : null, c.failedBody].filter(Boolean).join(" ")}
        action={{ label: c.tryAgain, href: pricing }}
      />
    );
  }

  // Pending: refresh a few times while RaiAccept finishes; then explain calmly.
  return (
    <>
      <StateView Icon={Clock} title={c.pendingTitle} body={c.pendingBody} />
      <PendingRefresh slowText={c.pendingSlow} accountHref={`/${lang}/app`} accountLabel={c.toAccount} />
    </>
  );
}
