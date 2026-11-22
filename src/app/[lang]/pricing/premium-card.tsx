"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Crown, FlaskConical } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { usePremium } from "@/lib/billing/use-premium";
import { beginCheckout, type CheckoutResult } from "./checkout-action";

type T = Messages["pricing"];
type Availability = "live" | "test" | "off";

/**
 * Premium plan as a card with a monthly / yearly choice (cards, not radio lists).
 * `checkout` (decided on the server): "live" = card payments open, "test" = RaiAccept sandbox for this
 * viewer (admins), "off" = "Premium coming soon".
 */
export function PremiumCard({
  t,
  lang,
  checkout,
  testModeText,
  monthly,
  yearly,
  yearlyPerMonth,
  savePercent,
  accountHref,
}: {
  t: T;
  lang: Locale;
  checkout: Availability;
  testModeText: string;
  monthly: string;
  yearly: string;
  yearlyPerMonth: string;
  savePercent: number;
  accountHref: string;
}) {
  const [interval, setInterval] = useState<"month" | "year">("year");
  const [error, setError] = useState<Exclude<CheckoutResult, { ok: true }>["error"] | null>(null);
  const [pending, startTransition] = useTransition();
  const premium = usePremium();
  const router = useRouter();
  const price = interval === "month" ? monthly : yearly;

  const pay = () => {
    setError(null);
    startTransition(async () => {
      const result = await beginCheckout({ plan: interval === "month" ? "monthly" : "yearly", lang }).catch(
        (): CheckoutResult => ({ ok: false, error: "failed" }),
      );
      if (result.ok) {
        window.location.assign(result.url); // RaiAccept's payment page (checked on the server)
        return new Promise<void>(() => {}); // keep the button busy while the page changes
      }
      const back = encodeURIComponent(`/${lang}/pricing`);
      if (result.error === "signin") router.push(`/${lang}/login?next=${back}`);
      else if (result.error === "consent") router.push(`/${lang}/app?next=${back}`);
      else setError(result.error);
    });
  };

  const payButton = (label: string, variant: "primary" | "secondary") => (
    <button
      type="button"
      onClick={pay}
      disabled={pending}
      aria-busy={pending || undefined}
      className={`pressable mt-3 inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-[17px] font-semibold disabled:opacity-70 ${
        variant === "primary"
          ? "bg-accent text-on-accent hover:bg-accent-pressed"
          : "bg-surface text-foreground ring-1 ring-hairline hover:bg-surface-2 dark:bg-surface-2"
      }`}
    >
      {pending ? t.redirecting : label.replace("{price}", price)}
    </button>
  );

  return (
    <div className="flex flex-col rounded-3xl bg-surface p-5 shadow-card ring-2 ring-accent">
      <div className="flex items-center gap-2">
        <Crown aria-hidden="true" className="h-5 w-5 text-accent-text" />
        <h2 className="text-[20px] font-bold">{t.premium}</h2>
      </div>
      <p className="mt-1 text-[15px] text-muted">{t.premiumTagline}</p>

      <div role="radiogroup" aria-label={t.plansLabel} className="mt-4 grid grid-cols-2 gap-2">
        {(
          [
            { id: "month", label: t.monthly, price: monthly, per: t.perMonth, note: null },
            { id: "year", label: t.yearly, price: yearly, per: t.perYear, note: t.save.replace("{n}", String(savePercent)) },
          ] as const
        ).map((plan) => {
          const selected = interval === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setInterval(plan.id)}
              className={`pressable flex flex-col items-start rounded-2xl p-3 text-left ${
                selected ? "bg-accent-soft ring-2 ring-accent-text" : "bg-surface-2 ring-1 ring-hairline"
              }`}
            >
              <span className="text-[13px] font-medium text-muted">{plan.label}</span>
              <span className="mt-0.5 text-[22px] leading-tight font-bold tabular-nums">{plan.price} €</span>
              <span className="text-[13px] text-muted">{plan.per}</span>
              {plan.note && (
                <span className="mt-1 rounded-full bg-accent px-2 py-0.5 text-[12px] font-semibold text-on-accent">{plan.note}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 min-h-5 text-[13px] text-muted" aria-live="polite">
        {interval === "year" ? t.yearlyEquivalent.replace("{price}", yearlyPerMonth) : ""}
      </p>

      {checkout === "test" && (
        <p className="mt-2 flex gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">
          <FlaskConical aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {testModeText}
        </p>
      )}

      {premium ? (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent-soft px-5 text-[17px] font-semibold text-accent-text">
            <Check aria-hidden="true" className="h-5 w-5" />
            {t.youArePremium}
          </p>
          {checkout !== "off" && payButton(t.extend, "secondary")}
          <Link href={accountHref} className="inline-flex min-h-11 items-center text-[15px] font-medium text-accent-text">
            {t.seeAccount}
          </Link>
        </div>
      ) : checkout === "off" ? (
        <button
          type="button"
          disabled
          aria-describedby="payment-note"
          className="mt-3 inline-flex h-12 cursor-not-allowed items-center justify-center rounded-full bg-accent/50 px-5 text-[17px] font-semibold text-on-accent"
        >
          {t.premiumSoon}
        </button>
      ) : (
        payButton(t.pay, "primary")
      )}

      {error && (
        <p role="alert" className="fade-in mt-3 rounded-xl bg-accent-soft px-4 py-3 text-[15px] font-medium text-accent-text">
          {t.checkoutErrors[error === "signin" || error === "consent" ? "failed" : error]}
        </p>
      )}
      <p id="payment-note" className="mt-2 text-[13px] text-muted">
        {checkout === "off" ? t.paymentNote : t.paymentNoteLive}
      </p>
    </div>
  );
}
