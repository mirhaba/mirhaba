import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  Bell,
  BookOpen,
  ChevronDown,
  Compass,
  Gem,
  GraduationCap,
  Languages,
  LayoutDashboard,
  LifeBuoy,
  Lightbulb,
  Mail,
  MessageCircle,
  PencilLine,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Truck,
  UserRound,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Messages } from "@/i18n/dictionaries";
import { OpenGuideButton } from "@/components/first-run-guide";
import { business } from "@/lib/business";
import { amount, fill, jsonLd } from "@/lib/format";
import { FREE_TEXT_TRANSLATIONS_PER_DAY, MAX_TRANSLATION_CHARS, PAID_TEXT_TRANSLATIONS_PER_DAY, PLANS } from "@/lib/plans";
import { dictionaryPath } from "@/lib/site";

type SectionKey = keyof Messages["help"]["sections"];
type TaskKey = keyof Messages["help"]["tasks"];

/**
 * Order, icon, link and "needs an account?" of every guide section. Kept in code (not in
 * messages/*.json) so an edit in Admin → UI text can change the words but never break an anchor.
 */
const SECTIONS: { key: SectionKey; icon: LucideIcon; account: boolean; href?: (lang: Locale) => string }[] = [
  { key: "start", icon: Smartphone, account: false, href: (l) => `/${l}/login?mode=signup` },
  { key: "quickTalk", icon: MessageCircle, account: false, href: (l) => `/${l}` },
  { key: "myPhrases", icon: PencilLine, account: false, href: (l) => `/${l}` },
  { key: "translate", icon: Languages, account: true, href: (l) => `/${l}/translate` },
  { key: "learn", icon: GraduationCap, account: false, href: (l) => `/${l}/learn` },
  { key: "dictionary", icon: BookOpen, account: false, href: (l) => dictionaryPath(l) },
  { key: "offline", icon: WifiOff, account: false },
  { key: "dashboard", icon: LayoutDashboard, account: true, href: (l) => `/${l}/app` },
  { key: "preferences", icon: SlidersHorizontal, account: true, href: (l) => `/${l}/app?tab=preferences` },
  { key: "reminders", icon: Bell, account: true, href: (l) => `/${l}/app?tab=preferences` },
  { key: "account", icon: ShieldCheck, account: true, href: (l) => `/${l}/app?tab=account` },
  { key: "premium", icon: Gem, account: true, href: (l) => `/${l}/pricing` },
];

/** "What do you want to do?" shortcuts → the section that answers it. */
const TASKS: { key: TaskKey; icon: LucideIcon; target: SectionKey }[] = [
  { key: "courier", icon: Truck, target: "quickTalk" },
  { key: "message", icon: Languages, target: "translate" },
  { key: "daily", icon: GraduationCap, target: "learn" },
  { key: "slang", icon: BookOpen, target: "dictionary" },
  { key: "offline", icon: WifiOff, target: "offline" },
  { key: "install", icon: Smartphone, target: "start" },
];

export async function generateMetadata({ params }: PageProps<"/[lang]/help">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).help;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: `/${lang}/help`, languages: { tr: "/tr/help", sq: "/sq/help", "x-default": "/tr/help" } },
  };
}

export default async function HelpPage({ params }: PageProps<"/[lang]/help">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const all = await getDictionary(lang);
  const t = all.help;
  const values = {
    freeTranslations: FREE_TEXT_TRANSLATIONS_PER_DAY,
    paidTranslations: PAID_TEXT_TRANSLATIONS_PER_DAY,
    maxChars: MAX_TRANSLATION_CHARS,
    monthly: amount(PLANS[0].priceEur, lang),
    yearly: amount(PLANS[1].priceEur, lang),
  };
  const f = (text: string) => fill(text, values);

  return (
    <div id="top" className="mx-auto flex max-w-2xl scroll-mt-20 flex-col gap-8">
      {/* Hero + the 1-minute tour for people who'd rather click through than read. */}
      <header className="fade-in flex flex-col gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[15px] font-medium text-accent-text">
            <LifeBuoy aria-hidden="true" className="h-4 w-4" />
            {t.eyebrow}
          </p>
          <h1 className="mt-1 text-[34px] leading-tight font-bold">{t.title}</h1>
          <p className="mt-1 text-[15px] text-muted">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-accent-soft p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent shadow-float">
            <Compass aria-hidden="true" className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold">{t.tourTitle}</p>
            <p className="text-[14px] leading-snug text-body">{t.tourBody}</p>
          </div>
          <OpenGuideButton
            label={t.tourCta}
            className="pressable inline-flex h-11 shrink-0 items-center rounded-full bg-accent px-4 text-[15px] font-semibold text-on-accent shadow-card"
          />
        </div>
      </header>

      {/* Task shortcuts: start from what the person wants to do, not from feature names. */}
      <section aria-labelledby="help-tasks">
        <h2 id="help-tasks" className="text-[20px] font-semibold">
          {t.tasksTitle}
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {TASKS.map(({ key, icon: Icon, target }, i) => (
            <li key={key} style={{ "--i": i } as CSSProperties} className="fade-in">
              <a
                href={`#${target}`}
                className="pressable flex h-full min-h-24 flex-col justify-between gap-2 rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-hairline hover:ring-accent-text/40"
              >
                <Icon aria-hidden="true" className="h-6 w-6 text-accent-text" />
                <span className="text-[15px] leading-snug font-semibold">{t.tasks[key]}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Table of contents. Native <details> so it works without JavaScript. */}
      <nav aria-labelledby="help-contents">
        <details className="group overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[17px] font-semibold active:bg-surface-2 [&::-webkit-details-marker]:hidden">
            <span id="help-contents">{t.contentsTitle}</span>
            <ChevronDown
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <ol className="border-t border-hairline px-2 py-2">
            {SECTIONS.map(({ key, icon: Icon }, i) => (
              <li key={key}>
                <a href={`#${key}`} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[16px] hover:bg-surface-2">
                  <span className="w-5 text-right text-[13px] text-muted tabular-nums">{i + 1}</span>
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-text" />
                  {t.sections[key].title}
                </a>
              </li>
            ))}
            <li>
              <a href="#trouble" className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-[16px] hover:bg-surface-2">
                <span className="w-5 text-right text-[13px] text-muted tabular-nums">{SECTIONS.length + 1}</span>
                <LifeBuoy aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-text" />
                {t.troubleTitle}
              </a>
            </li>
          </ol>
        </details>
      </nav>

      {SECTIONS.map(({ key, icon: Icon, account, href }, i) => {
        const s = t.sections[key];
        return (
          <section
            key={key}
            id={key}
            aria-labelledby={`${key}-title`}
            className="scroll-mt-20 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-hairline sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</p>
                <h2 id={`${key}-title`} className="text-[24px] leading-tight font-bold">
                  {s.title}
                </h2>
              </div>
            </div>

            <p className="mt-3 text-[16px] leading-relaxed text-body">{f(s.intro)}</p>
            <p
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                account ? "bg-surface-2 text-foreground" : "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
              {account ? t.needsAccount : t.noAccount}
            </p>

            <h3 className="sr-only">{t.stepsLabel}</h3>
            <ol className="mt-4 flex flex-col gap-3">
              {s.steps.map((step, n) => (
                <li key={n} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[14px] font-bold text-accent-text tabular-nums"
                  >
                    {n + 1}
                  </span>
                  <span className="pt-0.5 text-[16px] leading-relaxed">{f(step)}</span>
                </li>
              ))}
            </ol>

            <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-surface-2 px-3.5 py-3 text-[15px] leading-snug">
              <Lightbulb aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
              <span>
                <span className="font-semibold">{t.tipLabel}: </span>
                {f(s.tip)}
              </span>
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {href && s.cta ? (
                <Link
                  href={href(lang)}
                  prefetch={account ? false : undefined}
                  className="pressable inline-flex h-11 items-center gap-2 rounded-full bg-accent px-4 text-[15px] font-semibold text-on-accent shadow-card"
                >
                  {s.cta}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              ) : (
                <span />
              )}
              <a href="#top" className="inline-flex h-11 items-center gap-1 px-2 text-[14px] font-medium text-muted hover:text-foreground">
                <ArrowUp aria-hidden="true" className="h-4 w-4" />
                {t.backToTop}
              </a>
            </div>
          </section>
        );
      })}

      {/* Troubleshooting: the questions people actually get stuck on. */}
      <section id="trouble" aria-labelledby="trouble-title" className="scroll-mt-20">
        <h2 id="trouble-title" className="flex items-center gap-2 text-[24px] font-bold">
          <LifeBuoy aria-hidden="true" className="h-6 w-6 text-accent-text" />
          {t.troubleTitle}
        </h2>
        <div className="mt-3 overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
          {t.trouble.map((item) => (
            <details key={item.q} className="group border-b border-hairline last:border-b-0">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[17px] font-semibold transition-colors duration-150 active:bg-surface-2 [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <p className="px-4 pb-4 text-[15px] leading-relaxed text-body">{f(item.a)}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-surface-2 p-5">
        <h2 className="text-[20px] font-semibold">{t.moreTitle}</h2>
        <p className="mt-1 text-[15px] text-muted">{t.moreBody}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/${lang}/faq`}
            className="pressable inline-flex h-11 items-center gap-2 rounded-full bg-surface px-4 font-semibold shadow-card ring-1 ring-hairline"
          >
            {t.moreFaq}
          </Link>
          <a
            href={`mailto:${business.email}`}
            className="pressable inline-flex h-11 items-center gap-2 rounded-full bg-surface px-4 font-semibold text-accent-text shadow-card ring-1 ring-hairline"
          >
            <Mail aria-hidden="true" className="h-4 w-4" />
            {business.email}
          </a>
        </div>
      </section>

      {/* HowTo structured data for the first-steps section (search engines can show the steps). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          "@context": "https://schema.org",
          "@type": "HowTo",
          inLanguage: lang,
          name: `${all.help.title}: ${t.sections.quickTalk.title}`,
          description: t.sections.quickTalk.intro,
          step: t.sections.quickTalk.steps.map((text, n) => ({ "@type": "HowToStep", position: n + 1, text: f(text) })),
        })}
      />
    </div>
  );
}
