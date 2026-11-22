"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronRight, Flame, Lock, Map, MessageCircle, Plane, RotateCcw, type LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import type { Track } from "@/lib/content/model";
import { fill } from "@/lib/format";
import { usePremium } from "@/lib/billing/use-premium";
import { getLessonProgress, getStreak, syncWithAccount, weakItemIds, type Streak } from "@/lib/learn/progress";
import { courseOf, progressSlug, tracksFor, type Course } from "@/lib/learn/course";
import { updatePreferences, usePreferences } from "@/lib/preferences";
import type { LessonProgressRow } from "@/lib/offline-db";

type T = Messages["learn"];
const TRACK_ICONS: Record<Track["icon"], LucideIcon> = { plane: Plane, map: Map, message: MessageCircle };

type State = { progress: Record<string, LessonProgressRow>; streak: Streak; weak: number } | null;

/** Page title and subtitle: "Learn Albanian" or, in the Turkish course, "Learn Turkish". */
export function LearnTitle({ t }: { t: T }) {
  const course = courseOf(usePreferences().direction);
  return (
    <div>
      <h1 className="text-[34px] leading-tight font-bold">{course === "tr" ? t.turkishCourse.title : t.title}</h1>
      <p className="mt-1 text-[15px] text-muted">{course === "tr" ? t.turkishCourse.subtitle : t.subtitle}</p>
    </div>
  );
}

/** Albanian | Turkish: the course follows the learning direction in Preferences. */
function CourseSwitch({ t, course }: { t: T; course: Course }) {
  return (
    <div role="radiogroup" aria-label={t.turkishCourse.courseLabel} className="flex rounded-xl bg-surface-2 p-1">
      {(["sq", "tr"] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === course}
          onClick={() => c !== course && updatePreferences({ direction: c === "sq" ? "tr-sq" : "sq-tr" })}
          className={`pressable flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-[15px] font-semibold ${
            c === course ? "bg-surface text-foreground shadow-card" : "text-muted"
          }`}
        >
          <span
            aria-hidden="true"
            className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${c === "tr" ? "bg-brand-red text-white" : "bg-brand-ink text-brand-paper"}`}
          >
            {c.toUpperCase()}
          </span>
          {c === "sq" ? t.turkishCourse.courseSq : t.turkishCourse.courseTr}
        </button>
      ))}
    </div>
  );
}

export function LearnHome({ lang, t, tracks: allTracks }: { lang: Locale; t: T; tracks: Track[] }) {
  const [state, setState] = useState<State>(null); // null = still reading the device
  const premium = usePremium() === true; // UI only: the lesson page checks access on the server
  const course = courseOf(usePreferences().direction);
  const tracks = tracksFor(allTracks, course);

  useEffect(() => {
    const load = () =>
      Promise.all([getLessonProgress(), getStreak({ premium }), weakItemIds(8, course)]).then(([progress, streak, weak]) =>
        setState({ progress, streak, weak: weak.length }),
      );
    // Show this phone's progress immediately, then merge with the account (if signed in) and refresh.
    void load()
      .then(() => syncWithAccount())
      .then((changed) => {
        if (changed) void load();
      });
  }, [premium, course]);

  // The next lesson to do: the first open lesson not completed yet.
  const allLessons = tracks.flatMap((tr) => tr.units.filter((u) => u.isFree || premium).flatMap((u) => u.lessons));
  const next = state ? allLessons.find((l) => !state.progress[progressSlug(l.slug, course)]) : undefined;
  const doneCount = state ? allLessons.filter((l) => state.progress[progressSlug(l.slug, course)]).length : 0;

  return (
    <div className="flex flex-col gap-6">
      <CourseSwitch t={t} course={course} />
      <div className="grid grid-cols-2 gap-3">
        {/* Streak */}
        <div className="flex flex-col justify-between rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
          {state ? (
            <>
              <Flame
                aria-hidden="true"
                className={`h-6 w-6 ${state.streak.current ? "text-accent-text" : "text-muted"}`}
                fill={state.streak.current ? "currentColor" : "none"}
              />
              <p className="mt-2 text-[17px] leading-tight font-semibold">
                {state.streak.current ? fill(t.streak, { n: state.streak.current }) : t.streakZero}
              </p>
              {state.streak.longest > 1 && (
                <p className="mt-1 text-[13px] text-muted">{fill(t.longest, { n: state.streak.longest })}</p>
              )}
            </>
          ) : (
            <div aria-hidden="true" className="space-y-2">
              <div className="skeleton h-6 w-6 rounded-full" />
              <div className="skeleton h-4 w-4/5 rounded" />
            </div>
          )}
        </div>

        {/* Review weak words */}
        {state && state.weak > 0 ? (
          <Link
            href={`/${lang}/learn/review`}
            className="pressable flex flex-col justify-between rounded-2xl bg-accent-soft p-4 ring-1 ring-hairline"
          >
            <RotateCcw aria-hidden="true" className="h-6 w-6 text-accent-text" />
            <span className="mt-2 block text-[17px] leading-tight font-semibold">{t.review}</span>
            <span className="mt-1 block text-[13px] text-accent-text">{fill(t.reviewCount, { n: state.weak })}</span>
          </Link>
        ) : (
          <div className="flex flex-col justify-between rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
            <RotateCcw aria-hidden="true" className="h-6 w-6 text-muted" />
            {state ? (
              <p className="mt-2 text-[15px] text-muted">{t.reviewEmpty}</p>
            ) : (
              <div aria-hidden="true" className="skeleton mt-2 h-4 w-4/5 rounded" />
            )}
          </div>
        )}
      </div>

      {tracks.map((track) => {
        const Icon = TRACK_ICONS[track.icon];
        return (
          <section key={track.slug} aria-labelledby={`track-${track.slug}`}>
            <div className="mb-2 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent-text">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </div>
              <div>
                <h2 id={`track-${track.slug}`} className="text-[20px] leading-tight font-semibold">
                  {track.title[lang]}
                </h2>
                <p className="text-[15px] text-muted">{track.description[lang]}</p>
              </div>
            </div>

            {track.units.map((unit) => (
              <div key={unit.slug} className="mt-3">
                <h3 className="mb-1.5 px-1 text-[13px] font-medium text-muted">
                  {unit.title[lang]} · {fill(t.lessons, { n: unit.lessons.length })}
                  {!unit.isFree && ` · ${t.locked}`}
                </h3>
                <ol className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
                  {unit.lessons.map((lesson, i) => {
                    const done = state?.progress[progressSlug(lesson.slug, course)];
                    const isNext = next?.slug === lesson.slug;
                    const locked = !unit.isFree && !premium;
                    const content = (
                      <>
                        <span
                          aria-hidden="true"
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-bold tabular-nums ${
                            done ? "bg-accent text-on-accent" : isNext ? "bg-accent-soft text-accent-text ring-2 ring-accent-text" : "bg-surface-2 text-muted"
                          }`}
                        >
                          {locked ? <Lock className="h-4 w-4" /> : done ? <Check className="h-5 w-5" /> : i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[17px] leading-snug font-semibold">{lesson.title[lang]}</span>
                          <span className="block text-[13px] text-muted">
                            {lesson.situation[lang]} · {t.minutes}
                            {done ? ` · ${fill(t.best, { n: done.bestScore })}` : ""}
                          </span>
                        </span>
                        {isNext ? (
                          <span className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[13px] font-semibold text-on-accent">
                            {doneCount ? t.continue : t.start}
                          </span>
                        ) : (
                          !locked && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted/60" />
                        )}
                      </>
                    );
                    return (
                      <li key={lesson.slug} className="border-b border-hairline last:border-b-0">
                        {/* Locked lessons still open: the lesson page explains how to unlock them. */}
                        <Link
                          href={`/${lang}/learn/${lesson.slug}`}
                          aria-label={`${lesson.title[lang]}${locked ? `, ${t.locked}` : done ? `, ${t.done}` : ""}`}
                          className={`flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-150 active:bg-surface-2 ${locked ? "opacity-60" : ""}`}
                        >
                          {content}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
