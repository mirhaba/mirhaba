import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronDown, Mail } from "lucide-react";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { business } from "@/lib/business";
import { amount, fill, jsonLd } from "@/lib/format";
import { FREE_TEXT_TRANSLATIONS_PER_DAY, PLANS } from "@/lib/plans";

export async function generateMetadata({ params }: PageProps<"/[lang]/faq">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).faq;
  return {
    title: t.title,
    description: t.metaDescription,
    alternates: { canonical: `/${lang}/faq`, languages: { tr: "/tr/faq", sq: "/sq/faq", "x-default": "/tr/faq" } },
  };
}

export default async function FaqPage({ params }: PageProps<"/[lang]/faq">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (await getDictionary(lang)).faq;
  const values = {
    freeTranslations: FREE_TEXT_TRANSLATIONS_PER_DAY,
    monthly: amount(PLANS[0].priceEur, lang),
    yearly: amount(PLANS[1].priceEur, lang),
  };
  const items = t.items.map((item) => ({ q: item.q, a: fill(item.a, values) }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-[34px] leading-tight font-bold">{t.title}</h1>
        <p className="mt-1 text-[15px] text-muted">{t.subtitle}</p>
      </div>

      {/* Native <details>: keyboard and screen-reader friendly, works without JavaScript. */}
      <div className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
        {items.map((item, i) => (
          <details
            key={item.q}
            style={{ "--i": i } as React.CSSProperties}
            className="fade-in group border-b border-hairline last:border-b-0"
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[17px] font-semibold transition-colors duration-150 active:bg-surface-2 [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <p className="px-4 pb-4 text-[15px] leading-relaxed text-body">{item.a}</p>
          </details>
        ))}
      </div>

      <section className="rounded-2xl bg-surface-2 p-5">
        <h2 className="text-[20px] font-semibold">{t.contactTitle}</h2>
        <p className="mt-1 text-[15px] text-muted">{t.contactBody}</p>
        <a
          href={`mailto:${business.email}`}
          className="pressable mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-surface px-4 font-semibold text-accent-text shadow-card ring-1 ring-hairline"
        >
          <Mail aria-hidden="true" className="h-4 w-4" />
          {business.email}
        </a>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: lang,
          mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        })}
      />
    </div>
  );
}
