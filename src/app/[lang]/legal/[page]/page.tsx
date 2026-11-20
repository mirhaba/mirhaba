import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { legalPages, type LegalPage } from "@/lib/site";
import { BusinessDetails } from "@/components/business-details";

const isLegalPage = (p: string): p is LegalPage => (legalPages as readonly string[]).includes(p);

export function generateStaticParams() {
  return locales.flatMap((lang) => legalPages.map((page) => ({ lang, page })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/legal/[page]">): Promise<Metadata> {
  const { lang, page } = await params;
  if (!hasLocale(lang) || !isLegalPage(page)) return {};
  const t = await getDictionary(lang);
  return {
    title: t.legal[page].title,
    alternates: {
      canonical: `/${lang}/legal/${page}`,
      languages: { tr: `/tr/legal/${page}`, sq: `/sq/legal/${page}`, "x-default": `/tr/legal/${page}` },
    },
  };
}

export default async function LegalPageView({ params }: PageProps<"/[lang]/legal/[page]">) {
  const { lang, page } = await params;
  if (!hasLocale(lang) || !isLegalPage(page)) notFound();
  const t = await getDictionary(lang);
  const content = t.legal[page];

  return (
    <article className="fade-in max-w-prose py-2">
      <h1 className="text-[34px] leading-tight font-bold">{content.title}</h1>
      <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-[15px] text-accent-text">{t.legal.draft}</p>
      {content.body.map((paragraph) => (
        <p key={paragraph} className="mt-4 text-[17px] leading-relaxed">
          {paragraph}
        </p>
      ))}
      {page === "contact" && <BusinessDetails t={t.footer} />}
    </article>
  );
}
