"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Crown } from "lucide-react";
import type { Messages } from "@/i18n/dictionaries";
import { usePremium } from "@/lib/billing/use-premium";

type T = Messages["pricing"];

/**
 * Premium plan as a card with a monthly / yearly choice (cards, not radio lists).
 * Checkout stays disabled until RaiAccept is live; the reason is stated right below.
 */
export function PremiumCard({
  t,
  monthly,
  yearly,
  yearlyPerMonth,
  savePercent,
  accountHref,
}: {
  t: T;
  monthly: string;
  yearly: string;
  yearlyPerMonth: string;
  savePercent: number;
  accountHref: string;
}) {
  const [interval, setInterval] = useState<"month" | "year">("year");
  const premium = usePremium();

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

      {premium ? (
        <div className="mt-3 flex flex-col items-center gap-2">
          <p className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent-soft px-5 text-[17px] font-semibold text-accent-text">
            <Check aria-hidden="true" className="h-5 w-5" />
            {t.youArePremium}
          </p>
          <Link href={accountHref} className="text-[15px] font-medium text-accent-text">
            {t.seeAccount}
          </Link>
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled
            aria-describedby="payment-note"
            className="mt-3 inline-flex h-12 cursor-not-allowed items-center justify-center rounded-full bg-accent/50 px-5 text-[17px] font-semibold text-on-accent"
          >
            {t.premiumSoon}
          </button>
          <p id="payment-note" className="mt-2 text-[13px] text-muted">
            {t.paymentNote}
          </p>
        </>
      )}
    </div>
  );
}
