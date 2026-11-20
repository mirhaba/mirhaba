import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Check, Hourglass, Languages, MessageCircle, ShieldCheck, type LucideIcon } from "lucide-react";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { LogoMark } from "@/components/brand/Logo";
import { business } from "@/lib/business";
import { jsonLd } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { siteUrl } from "@/lib/site";

const FEATURE_ICONS: LucideIcon[] = [MessageCircle, Languages, BookOpen, ShieldCheck];

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).about;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: `/${lang}/about`, languages: { tr: "/tr/about", sq: "/sq/about", "x-default": "/tr/about" } },
  };
}

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (await getDictionary(lang)).about;

  return (
    <div className="flex flex-col gap-12 pb-4">
      {/* Hero: one big message, one primary action. */}
      <section className="fade-in flex flex-col items-start gap-5 pt-4">
        <LogoMark height={64} />
        <div>
          <p className="text-[15px] font-medium text-accent-text">{t.eyebrow}</p>
          <h1 className="mt-2 text-[40px] leading-[1.08] font-bold sm:text-[52px]">{t.title}</h1>
          <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-muted">{t.subtitle}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link
            href={`/${lang}`}
            className="pressable inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-[17px] font-semibold text-on-accent hover:bg-accent-pressed"
          >
            {t.ctaPrimary}
          </Link>
          <Link
            href={`/${lang}/pricing`}
            className="pressable inline-flex h-12 items-center justify-center rounded-full bg-surface px-6 text-[17px] font-semibold shadow-card ring-1 ring-hairline hover:bg-surface-2"
          >
            {t.ctaSecondary}
          </Link>
        </div>
      </section>

      <section aria-labelledby="features">
        <h2 id="features" className="text-[24px] font-bold">
          {t.featuresTitle}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {t.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? MessageCircle;
            return (
              <li
                key={f.title}
                style={{ "--i": i } as React.CSSProperties}
                className="fade-in rounded-2xl bg-surface p-5 shadow-card ring-1 ring-hairline"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-[17px] font-semibold">{f.title}</h3>
                <p className="mt-1 text-[15px] text-muted">{f.body}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-[24px] font-bold">
          {t.howTitle}
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {t.how.map((step, i) => (
            <li key={step} className="flex gap-3 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline sm:flex-col">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-bold text-on-accent tabular-nums"
              >
                {i + 1}
              </span>
              <span className="text-[15px]">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="audience">
        <h2 id="audience" className="text-[24px] font-bold">
          {t.audienceTitle}
        </h2>
        <ul className="mt-4 overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
          {t.audience.map((a) => (
            <li key={a} className="flex items-center gap-3 border-b border-hairline px-4 py-3.5 text-[17px] last:border-b-0">
              <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-accent-text" />
              {a}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="honesty" className="rounded-2xl bg-surface-2 p-5">
        <h2 id="honesty" className="text-[20px] font-semibold">
          {t.honestyTitle}
        </h2>
        <p className="mt-1 text-[15px] leading-relaxed text-body">{t.honesty}</p>
      </section>

      <section aria-labelledby="coming">
        <h2 id="coming" className="flex items-center gap-2 text-[20px] font-semibold">
          <Hourglass aria-hidden="true" className="h-5 w-5 text-muted" />
          {t.comingTitle}
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-[15px] text-muted">
          {t.coming.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd([
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: business.name || "Mirhaba",
            url: siteUrl,
            logo: `${siteUrl}/icons/icon-512.png`,
            email: business.email,
            ...(business.address ? { address: business.address } : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Mirhaba",
            url: `${siteUrl}/${lang}`,
            applicationCategory: "EducationalApplication",
            operatingSystem: "Any (web, Android, iOS)",
            inLanguage: ["tr", "sq"],
            description: t.metaDescription,
            offers: [
              { "@type": "Offer", price: "0", priceCurrency: "EUR" },
              ...PLANS.map((p) => ({ "@type": "Offer", price: p.priceEur.toFixed(2), priceCurrency: "EUR" })),
            ],
          },
        ])}
      />
    </div>
  );
}
