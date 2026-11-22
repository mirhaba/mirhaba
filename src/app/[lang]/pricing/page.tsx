import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { amount, fill } from "@/lib/format";
import { FREE_TEXT_TRANSLATIONS_PER_DAY, PLANS, YEARLY_SAVING_PERCENT } from "@/lib/plans";
import { PremiumCard } from "./premium-card";

/** Indexes into `pricing.rows` of features that already exist (others are marked "coming soon"). */
const AVAILABLE_NOW = [0, 1, 2, 4, 5];

export async function generateMetadata({ params }: PageProps<"/[lang]/pricing">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).pricing;
  return {
    title: t.title,
    description: fill(t.metaDescription, { monthly: amount(PLANS[0].priceEur, lang), yearly: amount(PLANS[1].priceEur, lang) }),
    alternates: { canonical: `/${lang}/pricing`, languages: { tr: "/tr/pricing", sq: "/sq/pricing", "x-default": "/tr/pricing" } },
  };
}

export default async function PricingPage({ params }: PageProps<"/[lang]/pricing">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (await getDictionary(lang)).pricing;
  const [monthly, yearly] = PLANS;
  const values = { freeTranslations: FREE_TEXT_TRANSLATIONS_PER_DAY };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[34px] leading-tight font-bold">{t.title}</h1>
        <p className="mt-1 text-[15px] text-muted">{t.subtitle}</p>
      </div>

      <div className="fade-in grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-3xl bg-surface p-5 shadow-card ring-1 ring-hairline">
          <h2 className="text-[20px] font-bold">{t.free}</h2>
          <p className="mt-1 text-[15px] text-muted">{t.freeTagline}</p>
          <p className="mt-4 text-[34px] leading-none font-bold tabular-nums">0 €</p>
          <ul className="mt-4 flex-1 space-y-2">
            {/* What the free plan includes today: Quick Talk, dictionary, translation, offline basics. */}
            {AVAILABLE_NOW.map((i) => t.rows[i])
              .filter(Boolean)
              .map((r) => (
                <li key={r.label} className="flex gap-2 text-[15px]">
                  <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
                  {/* "Dictionary: Yes" reads oddly next to a check mark: just the feature then. */}
                  <span>{r.free === t.yes ? r.label : `${r.label}: ${fill(r.free, values)}`}</span>
                </li>
              ))}
          </ul>
          <Link
            href={`/${lang}`}
            className="pressable mt-5 inline-flex h-12 items-center justify-center rounded-full bg-surface-2 px-5 text-[17px] font-semibold hover:bg-hairline"
          >
            {t.startFree}
          </Link>
        </div>

        <PremiumCard
          t={t}
          monthly={amount(monthly.priceEur, lang)}
          yearly={amount(yearly.priceEur, lang)}
          yearlyPerMonth={amount(yearly.priceEur / 12, lang)}
          savePercent={YEARLY_SAVING_PERCENT}
          accountHref={`/${lang}/app`}
        />
      </div>

      <p className="-mt-4 text-[13px] text-muted">{t.vat}</p>

      <section aria-labelledby="compare">
        <h2 id="compare" className="sr-only">
          {t.feature}
        </h2>
        {/* Narrow phones: tighter cells, and a long word ("drejtpërdrejtë") may break instead of widening the page. */}
        <table className="w-full overflow-hidden rounded-2xl bg-surface text-left shadow-card ring-1 ring-hairline [overflow-wrap:anywhere] sm:[overflow-wrap:normal]">
          <thead>
            <tr className="border-b border-hairline text-[13px] text-muted">
              <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                {t.feature}
              </th>
              <th scope="col" className="px-2 py-3 font-medium">
                {t.free}
              </th>
              <th scope="col" className="px-3 py-3 font-medium text-accent-text sm:px-4">
                {t.premium}
              </th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r) => (
              <tr key={r.label} className="border-b border-hairline align-top last:border-b-0">
                <th scope="row" className="px-3 py-3 text-[14px] font-medium sm:px-4 sm:text-[15px]">
                  {r.label}
                </th>
                <td className="px-2 py-3 text-[13px] text-muted">{fill(r.free, values)}</td>
                <td className="px-3 py-3 text-[13px] font-medium sm:px-4">{fill(r.premium, values)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="cancel" className="rounded-2xl bg-surface-2 p-5">
        <h2 id="cancel" className="text-[20px] font-semibold">
          {t.cancelTitle}
        </h2>
        <ul className="mt-2 space-y-2">
          {t.cancel.map((c) => (
            <li key={c} className="flex gap-2 text-[15px] text-body">
              <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
              {c}
            </li>
          ))}
        </ul>
        <Link href={`/${lang}/legal/refunds`} className="mt-3 inline-flex min-h-11 items-center text-[15px] font-semibold text-accent-text">
          {t.refundLink}
        </Link>
      </section>
    </div>
  );
}
