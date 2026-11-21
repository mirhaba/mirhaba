// Server-rendered dictionary pages (index + one page per word), shared by
// /tr/argo/... and /sq/zhargon/... so each language has one clean, indexable URL.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, CircleAlert, ExternalLink } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getDictionary, type Messages } from "@/i18n/dictionaries";
import { slang, slangBySlug, type SlangEntry } from "@/content/slang";
import { sources } from "@/content/sources";
import { dictionaryPath, siteUrl } from "@/lib/site";
import { DictionaryList } from "./dictionary-list";

type T = Messages["dictionary"];

const fill = (s: string, values: Record<string, string>) =>
  Object.entries(values).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, v), s);

export function wordTitle(entry: SlangEntry, t: T) {
  return fill(entry.term.lang === "sq" ? t.titleSq : t.titleTr, { term: entry.term.text });
}

export function wordDescription(entry: SlangEntry, t: T) {
  return fill(entry.term.lang === "sq" ? t.descSq : t.descTr, {
    term: entry.term.text,
    tr: entry.tr,
    std: entry.sqStandard,
    ks: entry.sqKosovo ?? entry.sqStandard,
  });
}

const languages = (slug?: string) => ({
  tr: dictionaryPath("tr", slug),
  sq: dictionaryPath("sq", slug),
  "x-default": dictionaryPath("tr", slug),
});

/** JSON for <script type="application/ld+json">, with "<" escaped so it can't close the tag. */
const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

// ---------------------------------------------------------------- Index

export async function dictionaryIndexMetadata(lang: Locale): Promise<Metadata> {
  const t = (await getDictionary(lang)).dictionary;
  return {
    title: t.title,
    description: t.metaDescription,
    alternates: { canonical: dictionaryPath(lang), languages: languages() },
  };
}

export async function DictionaryIndexPage({ lang }: { lang: Locale }) {
  const t = (await getDictionary(lang)).dictionary;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[34px] leading-tight font-bold">{t.title}</h1>
        <p className="mt-1 text-[15px] text-muted">{t.subtitle}</p>
      </div>
      <UnverifiedNote text={t.unverifiedBanner} />
      <DictionaryList lang={lang} t={t} entries={slang} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          "@context": "https://schema.org",
          "@type": "DefinedTermSet",
          name: t.title,
          description: t.metaDescription,
          url: `${siteUrl}${dictionaryPath(lang)}`,
          inLanguage: ["sq", "tr"],
        })}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Word page

export async function wordMetadata(lang: Locale, slug: string): Promise<Metadata> {
  const entry = slangBySlug[slug];
  if (!entry) return {};
  const t = (await getDictionary(lang)).dictionary;
  return {
    title: wordTitle(entry, t),
    description: wordDescription(entry, t),
    alternates: { canonical: dictionaryPath(lang, slug), languages: languages(slug) },
  };
}

export async function WordPage({ lang, slug }: { lang: Locale; slug: string }) {
  const entry = slangBySlug[slug];
  if (!entry) notFound();
  const messages = await getDictionary(lang);
  const t = messages.dictionary;

  const related = slang.filter((s) => s.kind === entry.kind && s.slug !== entry.slug);
  const start = slang.indexOf(entry) % Math.max(related.length, 1);
  const relatedFour = [...related.slice(start), ...related.slice(0, start)].slice(0, 4);

  const rows: { label: string; value: string; lang: "tr" | "sq" }[] = [
    { label: t.turkish, value: entry.tr, lang: "tr" },
    { label: t.standard, value: entry.sqStandard, lang: "sq" },
    ...(entry.sqKosovo && entry.sqKosovo !== entry.sqStandard ? [{ label: t.kosovo, value: entry.sqKosovo, lang: "sq" as const }] : []),
  ];

  return (
    <article className="fade-in mx-auto flex max-w-xl flex-col gap-6">
      <Link
        href={dictionaryPath(lang)}
        className="pressable -ml-2 inline-flex h-11 w-fit items-center gap-1.5 rounded-full px-2 text-[15px] font-medium text-accent-text"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t.back}
      </Link>

      <header>
        <p className="text-[13px] font-medium text-muted">{t[entry.kind]}</p>
        <h1 lang={entry.term.lang} className="mt-1 text-[40px] leading-tight font-bold break-words">
          {entry.term.text}
        </h1>
        <p className="mt-1 text-[17px] text-muted">{wordTitle(entry, t)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone={entry.register === "vulgar" ? "accent" : "neutral"}>
            {t.registerLabel}: {t.register[entry.register]}
          </Chip>
          {entry.origin && (
            <Chip>
              {t.originLabel}: {t.origin[entry.origin]}
            </Chip>
          )}
        </div>
      </header>

      <dl className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-hairline px-4 py-3.5 last:border-b-0">
            <dt className="shrink-0 text-[15px] text-muted">{row.label}</dt>
            <dd lang={row.lang} className="text-right text-[17px] font-semibold">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <section>
        <h2 className="text-[20px] font-semibold">{t.meaning}</h2>
        <p className="mt-1 text-[17px] leading-relaxed">{entry.meaning[lang]}</p>
      </section>

      {entry.example && (
        <section>
          <h2 className="text-[20px] font-semibold">{t.example}</h2>
          <div className="mt-2 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
            <p lang="sq" className="text-[20px] font-semibold">
              {entry.example.sq}
            </p>
            <p lang="tr" className="mt-1 text-[17px] text-muted">
              {entry.example.tr}
            </p>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        {entry.verified ? (
          <p className="flex items-center gap-2 text-[15px] text-muted">
            <BadgeCheck aria-hidden="true" className="h-5 w-5 text-accent-text" />
            {t.verified}
          </p>
        ) : (
          <UnverifiedNote text={t.unverified} />
        )}
        <h2 className="mt-2 text-[13px] font-medium text-muted">{t.sources}</h2>
        <ul className="space-y-1 text-[13px] text-muted">
          {entry.sources.map((id) => {
            const source = sources[id];
            const label = id === "team" ? t.sourceTeam : source.label;
            return (
              <li key={id}>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex min-h-8 items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {label}
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ) : (
                  label
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {relatedFour.length > 0 && (
        <section>
          <h2 className="mb-2 text-[20px] font-semibold">{t.related}</h2>
          <ul className="grid grid-cols-2 gap-2">
            {relatedFour.map((r) => (
              <li key={r.slug}>
                <Link
                  href={dictionaryPath(lang, r.slug)}
                  className="pressable flex min-h-14 flex-col justify-center rounded-2xl bg-surface px-4 py-2 shadow-card ring-1 ring-hairline hover:bg-surface-2"
                >
                  <span lang={r.term.lang} className="font-semibold">
                    {r.term.text}
                  </span>
                  <span className="truncate text-[13px] text-muted">{r.term.lang === "sq" ? r.tr : (r.sqKosovo ?? r.sqStandard)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/${lang}/translate`}
          className="pressable inline-flex h-12 flex-1 items-center justify-center rounded-full bg-accent px-5 font-semibold text-on-accent hover:bg-accent-pressed"
        >
          {t.tryTranslate}
        </Link>
        <Link
          href={`/${lang}`}
          className="pressable inline-flex h-12 flex-1 items-center justify-center rounded-full bg-surface px-5 font-semibold shadow-card ring-1 ring-hairline hover:bg-surface-2"
        >
          {t.tryQuickTalk}
        </Link>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          "@context": "https://schema.org",
          "@type": "DefinedTerm",
          name: entry.term.text,
          inLanguage: entry.term.lang,
          description: entry.meaning[lang],
          alternateName: [entry.tr, entry.sqStandard, entry.sqKosovo].filter((v): v is string => !!v && v !== entry.term.text),
          url: `${siteUrl}${dictionaryPath(lang, entry.slug)}`,
          inDefinedTermSet: { "@type": "DefinedTermSet", name: t.title, url: `${siteUrl}${dictionaryPath(lang)}` },
        })}
      />
    </article>
  );
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[13px] font-medium ${
        tone === "accent" ? "bg-accent-soft text-accent-text" : "bg-surface-2 text-muted"
      }`}
    >
      {children}
    </span>
  );
}

function UnverifiedNote({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-[15px] text-muted">
      <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      {text}
    </p>
  );
}

export const allSlugs = () => slang.map((s) => ({ slug: s.slug }));

/** Placeholder shaped like a word page, shown while the route reads its params. */
export function WordPageSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4 py-2">
      <div className="skeleton h-4 w-28 rounded" />
      <div className="skeleton h-12 w-1/2 rounded-lg" />
      <div className="skeleton h-5 w-3/4 rounded" />
      <div className="skeleton h-40 rounded-2xl" />
    </div>
  );
}
