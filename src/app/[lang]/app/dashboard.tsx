"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  ChevronRight,
  Compass,
  Crown,
  Flame,
  GraduationCap,
  Languages,
  Lock,
  MessageCircle,
  Settings2,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRound,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { sectionHref } from "@/lib/site";
import { OPEN_GUIDE_EVENT, usePreferences } from "@/lib/preferences";
import { getDB, listFavorites } from "@/lib/offline-db";
import { getLessonProgress, getStreak, getToday, syncWithAccount, weakItemIds } from "@/lib/learn/progress";
import { speakAlbanian, speakTurkish } from "@/components/quick-talk/speak";
import { Confetti } from "@/components/confetti";

export type Tab = "overview" | "preferences" | "account";
const TABS: Tab[] = ["overview", "preferences", "account"];

type Stats = { streak: number; longest: number; lessons: number; words: number; favorites: number; today: number; review: number };
const EMPTY: Stats = { streak: 0, longest: 0, lessons: 0, words: 0, favorites: 0, today: 0, review: 0 };

async function loadStats(): Promise<Stats> {
  const [streak, lessons, favorites, today, review, words] = await Promise.all([
    getStreak(),
    getLessonProgress(),
    listFavorites().catch(() => []),
    getToday(),
    weakItemIds(50),
    getDB()
      .itemStats.filter((r) => r.correct > 0)
      .count()
      .catch(() => 0),
  ]);
  return {
    streak: streak.current,
    longest: streak.longest,
    lessons: Object.keys(lessons).length,
    words,
    favorites: favorites.length,
    today: today.sessions,
    review: review.length,
  };
}

/** The signed-in home: a tabbed dashboard (overview, preferences, account settings). */
export function Dashboard({
  lang,
  t,
  nav,
  initialTab,
  email,
  premium,
  phrase,
  preferences,
  account,
}: {
  lang: Locale;
  t: Messages["dashboard"];
  nav: Messages["nav"];
  initialTab: Tab;
  email: string;
  premium: boolean;
  phrase: { tr: string; sq: string; audio?: string } | null;
  preferences: ReactNode;
  account: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const labels: Record<Tab, string> = { overview: t.tabOverview, preferences: t.tabPreferences, account: t.tabAccount };
  const icons: Record<Tab, LucideIcon> = { overview: Sparkles, preferences: Settings2, account: UserRound };

  const select = (next: Tab, focus = false) => {
    setTab(next);
    if (focus) tabRefs.current[TABS.indexOf(next)]?.focus();
    // Keep the tab in the URL (shareable, survives reload) without a navigation.
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    url.searchParams.delete("password");
    window.history.replaceState(window.history.state, "", url);
  };

  const index = TABS.indexOf(tab);

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label={t.tabsLabel}
        className="relative grid grid-cols-3 rounded-2xl bg-surface-2 p-1"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") select(TABS[(index + 1) % TABS.length], true);
          if (e.key === "ArrowLeft") select(TABS[(index + TABS.length - 1) % TABS.length], true);
        }}
      >
        {/* Sliding pill behind the selected tab */}
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 left-1 rounded-xl bg-surface shadow-card transition-transform duration-300 ease-out-soft"
          style={{ width: "calc((100% - 0.5rem) / 3)", transform: `translateX(${index * 100}%)` }}
        />
        {TABS.map((key, i) => {
          const Icon = icons[key];
          const selected = key === tab;
          return (
            <button
              key={key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={`${baseId}-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(key)}
              className={`pressable relative z-10 flex h-11 items-center justify-center gap-1.5 rounded-xl px-1 text-[14px] font-semibold min-[380px]:text-[15px] ${
                selected ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              <Icon aria-hidden="true" className="hidden h-4 w-4 min-[400px]:block" />
              {labels[key]}
            </button>
          );
        })}
      </div>

      {TABS.map((key) => (
        <div
          key={key}
          role="tabpanel"
          id={`${baseId}-panel-${key}`}
          aria-labelledby={`${baseId}-tab-${key}`}
          hidden={key !== tab}
          tabIndex={-1}
          className="outline-none"
        >
          {key === tab &&
            (key === "overview" ? (
              <Overview lang={lang} t={t} nav={nav} email={email} premium={premium} phrase={phrase} onPreferences={() => select("preferences")} />
            ) : key === "preferences" ? (
              preferences
            ) : (
              account
            ))}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ overview

function greeting(t: Messages["dashboard"]): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return t.greetMorning;
  if (h >= 12 && h < 18) return t.greetDay;
  if (h >= 18 && h < 23) return t.greetEvening;
  return t.greetNight;
}

function Overview({
  lang,
  t,
  nav,
  email,
  premium,
  phrase,
  onPreferences,
}: {
  lang: Locale;
  t: Messages["dashboard"];
  nav: Messages["nav"];
  email: string;
  premium: boolean;
  phrase: { tr: string; sq: string; audio?: string } | null;
  onPreferences: () => void;
}) {
  const prefs = usePreferences();
  const [stats, setStats] = useState<Stats | null>(null);
  const [hello, setHello] = useState("");

  useEffect(() => {
    let alive = true;
    // The greeting depends on the local clock, so it's set in the browser only.
    const timer = setTimeout(() => setHello(greeting(t)), 0);
    loadStats().then((s) => alive && setStats(s));
    // Signed in: merge progress from other devices, then refresh the numbers.
    syncWithAccount()
      .then((changed) => (changed ? loadStats() : null))
      .then((s) => s && alive && setStats(s))
      .catch(() => {});
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [t]);

  const name = prefs.nickname || email.split("@")[0];
  const s = stats ?? EMPTY;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="fade-in relative overflow-hidden rounded-3xl bg-brand-ink p-5 text-brand-paper shadow-float">
        <DottedArc />
        <div className="relative flex items-center gap-4">
          <span className="pop-in flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-red text-[24px] font-bold text-white uppercase shadow-float">
            {name.slice(0, 1) || "M"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="min-h-5 text-[14px] text-brand-paper/70">{hello}</p>
            <h2 className="truncate text-[24px] leading-tight font-bold">{name}</h2>
          </div>
          {premium && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-gold px-2.5 py-1 text-[12px] font-bold text-brand-ink">
              <Crown aria-hidden="true" className="h-3.5 w-3.5" />
              Premium
            </span>
          )}
        </div>
        <p className="relative mt-3 text-[15px] text-brand-paper/80">{t.greetSub}</p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy={!stats}>
        <StatTile i={0} Icon={Flame} value={s.streak} label={t.statStreak} tone="text-orange-500" hot={s.streak > 0} />
        <StatTile i={1} Icon={GraduationCap} value={s.lessons} label={t.statLessons} tone="text-accent-text" />
        <StatTile i={2} Icon={BookOpen} value={s.words} label={t.statWords} tone="text-emerald-600 dark:text-emerald-400" />
        <StatTile i={3} Icon={Star} value={s.favorites} label={t.statFavorites} tone="text-brand-gold" />
      </section>

      <GoalCard lang={lang} t={t} goal={prefs.dailyGoal} done={s.today} review={s.review} ready={!!stats} onEdit={onPreferences} />

      {phrase && <PhraseOfTheDay t={t} phrase={phrase} direction={prefs.direction} />}

      {/* Quick access */}
      <section>
        <h2 className="mb-2 px-1 text-[13px] font-medium text-muted">{t.quickTitle}</h2>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { key: "quickTalk", Icon: MessageCircle },
              { key: "translate", Icon: Languages },
              { key: "learn", Icon: GraduationCap },
              { key: "dictionary", Icon: BookOpen },
            ] as const
          ).map(({ key, Icon }, i) => (
            <Link
              key={key}
              href={sectionHref(key, lang)}
              style={{ "--i": i } as CSSProperties}
              className="fade-in pressable group flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-hairline hover:ring-accent-text/40"
            >
              <span className="wiggle flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 text-[15px] leading-tight font-semibold">{nav[key]}</span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted/60 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>

      <Badges t={t} stats={s} ready={!!stats} />

      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_GUIDE_EVENT, { detail: { step: 1 } }))}
        className="pressable flex items-center gap-3 rounded-2xl bg-surface p-4 text-left shadow-card ring-1 ring-hairline hover:ring-accent-text/40"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-on-accent">
          <Compass aria-hidden="true" className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-[17px] font-semibold">{t.tour}</span>
          <span className="block text-[13px] text-muted">{t.tourHint}</span>
        </span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted/60" />
      </button>

      <p className="px-1 text-[13px] text-muted">{t.deviceNote}</p>
    </div>
  );
}

/** The brand's dotted arc, as a quiet decoration on the hero. */
function DottedArc() {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 120" className="absolute -top-6 -right-10 h-40 w-64 opacity-60">
      <path d="M10 110 Q100 -30 190 110" fill="none" stroke="var(--brand-gold)" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
    </svg>
  );
}

/** Counts up from 0 to `value` once (instant under reduced motion). */
function useCountUp(value: number) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
    if (reduce || value === 0) {
      const timer = setTimeout(() => setShown(value), 0);
      return () => clearTimeout(timer);
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

function StatTile({ i, Icon, value, label, tone, hot }: { i: number; Icon: LucideIcon; value: number; label: string; tone: string; hot?: boolean }) {
  const shown = useCountUp(value);
  return (
    <div style={{ "--i": i } as CSSProperties} className="fade-in rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-hairline">
      <Icon aria-hidden="true" className={`h-6 w-6 ${tone} ${hot ? "float" : ""}`} fill={hot ? "currentColor" : "none"} />
      <p className="mt-2 text-[28px] leading-none font-bold tabular-nums">{shown}</p>
      <p className="mt-1 text-[13px] leading-tight text-muted">{label}</p>
    </div>
  );
}

function GoalCard({
  lang,
  t,
  goal,
  done,
  review,
  ready,
  onEdit,
}: {
  lang: Locale;
  t: Messages["dashboard"];
  goal: number;
  done: number;
  review: number;
  ready: boolean;
  onEdit: () => void;
}) {
  const progress = Math.min(1, done / goal);
  const complete = ready && done >= goal;
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const [shownProgress, setShownProgress] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setShownProgress(ready ? progress : 0), 60);
    return () => clearTimeout(timer);
  }, [progress, ready]);

  return (
    <section className="fade-in relative overflow-hidden rounded-3xl bg-surface p-5 shadow-card ring-1 ring-hairline">
      {complete && <Confetti burstKey={done} pieces={30} originY="40%" />}
      <div className="flex items-center gap-5">
        <div className="relative h-[88px] w-[88px] shrink-0">
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke={complete ? "#16a34a" : "var(--accent)"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - shownProgress)}
              className="ring-progress"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center">
            {complete ? (
              <Trophy aria-hidden="true" className="pop-in h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Target aria-hidden="true" className="h-8 w-8 text-accent-text" />
            )}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-medium text-muted">{t.goalTitle}</h2>
          <p className="text-[22px] font-bold tabular-nums">
            {t.goalProgress.replace("{done}", String(Math.min(done, goal))).replace("{goal}", String(goal))}
          </p>
          <p aria-live="polite" className="text-[14px] text-muted">
            {ready ? (complete ? t.goalDone : t.goalTodo.replace("{n}", String(goal - done))) : " "}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={review > 0 && complete ? `/${lang}/learn/review` : sectionHref("learn", lang)}
          className="pressable inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 text-[15px] font-semibold text-on-accent hover:bg-accent-pressed"
        >
          <GraduationCap aria-hidden="true" className="h-[18px] w-[18px]" />
          {review > 0 && complete ? t.goalReview : t.goalCta}
        </Link>
        <button
          type="button"
          onClick={onEdit}
          className="pressable inline-flex h-11 items-center justify-center rounded-full px-4 text-[15px] font-semibold text-accent-text hover:bg-accent-soft"
        >
          {t.goalEdit}
        </button>
      </div>
    </section>
  );
}

function PhraseOfTheDay({
  t,
  phrase,
  direction,
}: {
  t: Messages["dashboard"];
  phrase: { tr: string; sq: string; audio?: string };
  direction: "tr-sq" | "sq-tr";
}) {
  const [flipped, setFlipped] = useState(false);
  // Front = the language being learned.
  const front = direction === "tr-sq" ? { text: phrase.sq, lang: "sq" } : { text: phrase.tr, lang: "tr" };
  const back = direction === "tr-sq" ? { text: phrase.tr, lang: "tr" } : { text: phrase.sq, lang: "sq" };
  return (
    <section className="fade-in">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-medium text-muted">{t.phraseTitle}</h2>
        <button
          type="button"
          onClick={() => (front.lang === "sq" ? speakAlbanian(phrase.sq, phrase.audio) : speakTurkish(phrase.tr))}
          className="pressable flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-accent-text hover:bg-accent-soft"
        >
          <Volume2 aria-hidden="true" className="h-4 w-4" />
          {t.listen}
        </button>
      </div>
      <button type="button" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped} data-flipped={flipped} className="flip block w-full text-left">
        <span className="flip-inner">
          <span className="flex min-h-32 flex-col justify-between rounded-3xl bg-surface p-5 shadow-card ring-1 ring-hairline">
            <span lang={front.lang} className="text-[26px] leading-tight font-bold">
              {front.text}
            </span>
            <span className="mt-3 flex items-center gap-1.5 text-[13px] text-muted">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              {t.phraseTap}
            </span>
          </span>
          <span className="flip-back flex min-h-32 flex-col justify-center rounded-3xl bg-accent p-5 text-on-accent shadow-float">
            <span lang={back.lang} className="text-[24px] leading-tight font-bold">
              {back.text}
            </span>
            <span lang={front.lang} className="mt-2 text-[14px] text-on-accent/80">
              {front.text}
            </span>
          </span>
        </span>
      </button>
    </section>
  );
}

type BadgeKey = keyof Messages["dashboard"]["badges"];

function Badges({ t, stats, ready }: { t: Messages["dashboard"]; stats: Stats; ready: boolean }) {
  const [selected, setSelected] = useState<BadgeKey | null>(null);
  const list: { key: BadgeKey; Icon: LucideIcon; unlocked: boolean }[] = [
    { key: "firstLesson", Icon: GraduationCap, unlocked: stats.lessons >= 1 },
    { key: "streak3", Icon: Flame, unlocked: stats.longest >= 3 },
    { key: "streak7", Icon: Trophy, unlocked: stats.longest >= 7 },
    { key: "words25", Icon: BookOpen, unlocked: stats.words >= 25 },
    { key: "favorites3", Icon: Star, unlocked: stats.favorites >= 3 },
    { key: "lessons10", Icon: Award, unlocked: stats.lessons >= 10 },
  ];
  const count = list.filter((b) => b.unlocked).length;
  const active = list.find((b) => b.key === selected);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-medium text-muted">{t.badgesTitle}</h2>
        <span className="text-[13px] font-semibold text-accent-text tabular-nums">
          {t.badgesCount.replace("{n}", String(count)).replace("{total}", String(list.length))}
        </span>
      </div>
      <div className="rounded-3xl bg-surface p-4 shadow-card ring-1 ring-hairline">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {list.map(({ key, Icon, unlocked }, i) => (
            <button
              key={key}
              type="button"
              aria-pressed={selected === key}
              aria-label={`${t.badges[key].title}${unlocked ? "" : ` (${t.badgeLocked})`}`}
              onClick={() => setSelected((s) => (s === key ? null : key))}
              style={{ "--i": i } as CSSProperties}
              className={`${ready ? "pop-in" : "opacity-0"} pressable flex flex-col items-center gap-1.5 rounded-2xl p-2 ${selected === key ? "bg-surface-2" : ""}`}
            >
              <span
                className={`relative flex h-14 w-14 items-center justify-center rounded-full ${
                  unlocked ? "bg-brand-gold text-brand-ink shadow-float" : "bg-surface-2 text-muted/60"
                }`}
              >
                <Icon aria-hidden="true" className="h-6 w-6" />
                {!unlocked && (
                  <span className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface ring-1 ring-hairline">
                    <Lock aria-hidden="true" className="h-3 w-3" />
                  </span>
                )}
              </span>
              <span className={`text-center text-[12px] leading-tight font-medium ${unlocked ? "" : "text-muted"}`}>{t.badges[key].title}</span>
            </button>
          ))}
        </div>
        <div aria-live="polite">
          {active && (
            <p key={active.key} className="fade-in mt-3 rounded-2xl bg-surface-2 px-4 py-2.5 text-center text-[14px]">
              <span className="font-semibold">{t.badges[active.key].title}:</span> {t.badges[active.key].body}
              {!active.unlocked && <span className="text-muted"> · {t.badgeLocked}</span>}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
