"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Check, Flame, RotateCcw, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import type { Item } from "@/lib/content/model";
import { buildLesson, buildReview, checkOrder, checkTyped, retryOf, seedFrom, type Exercise } from "@/lib/learn/engine";
import { finishSession, recordAnswer, syncWithAccount, weakItemIds, type Streak } from "@/lib/learn/progress";
import { courseOf, itemFor, progressSlug, type Course } from "@/lib/learn/course";
import { usePreferences } from "@/lib/preferences";
import { usePremium } from "@/lib/billing/use-premium";
import { fill } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StateView } from "@/components/state-view";
import { Choose, LearnCard, Match, nativeOf, Order, PromptTarget, TypeAnswer } from "./exercises";

type T = Messages["learn"];
type Feedback = { correct: boolean; expected: string; accents?: boolean };

/**
 * One lesson (or a review round): exercises in order, wrong answers asked again once at
 * the end, score = first-try correct answers. Progress is saved on the device.
 */
export function LessonPlayer({
  lang,
  t,
  mode,
  lessonSlug,
  items,
  allItems,
  nextLessonSlug,
}: {
  lang: Locale;
  t: T;
  mode: "lesson" | "review";
  lessonSlug?: string;
  items?: Item[];
  /** Items the learner may see: wrong answer options come from here, review looks words up here. */
  allItems: Item[];
  nextLessonSlug?: string;
}) {
  // The course (Albanian or Turkish) comes from the learner's preference, which only the browser
  // knows: show the skeleton until hydrated, so the other course never flashes.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const course = courseOf(usePreferences().direction);
  return hydrated ? (
    <CoursePlayer
      key={course}
      lang={lang}
      t={t}
      mode={mode}
      lessonSlug={lessonSlug}
      items={items}
      allItems={allItems}
      nextLessonSlug={nextLessonSlug}
      course={course}
    />
  ) : (
    <PlayerSkeleton label={t.loading} />
  );
}

const noopSubscribe = () => () => {};

function CoursePlayer({
  lang,
  t,
  mode,
  lessonSlug,
  items: rawItems,
  allItems: rawAllItems,
  nextLessonSlug,
  course,
}: {
  lang: Locale;
  t: T;
  mode: "lesson" | "review";
  lessonSlug?: string;
  items?: Item[];
  allItems: Item[];
  nextLessonSlug?: string;
  course: Course;
}) {
  const items = useMemo(() => rawItems?.map((i) => itemFor(i, course)), [rawItems, course]);
  const allItems = useMemo(() => rawAllItems.map((i) => itemFor(i, course)), [rawAllItems, course]);
  // Words and labels of the Turkish course ("Choose the Turkish", "Write in Turkish"…).
  const courseT = useMemo<T>(() => (course === "tr" ? { ...t, player: { ...t.player, ...t.turkishCourse.player } } : t), [t, course]);
  const premium = usePremium() === true;
  const [attempt, setAttempt] = useState(0);
  const [reviewItems, setReviewItems] = useState<Item[] | null>(mode === "review" ? null : (items ?? []));

  useEffect(() => {
    if (mode !== "review") return;
    const byId = new Map(allItems.map((item) => [item.id, item]));
    weakItemIds(8, course).then((ids) => setReviewItems(ids.map((id) => byId.get(id)).filter((item): item is Item => !!item)));
  }, [mode, allItems, course]);

  if (!reviewItems) return <PlayerSkeleton label={t.loading} />;
  if (mode === "review" && reviewItems.length === 0) {
    return (
      <StateView
        Icon={RotateCcw}
        headingLevel={2}
        title={t.reviewEmptyTitle}
        body={t.reviewEmptyBody}
        action={{ label: t.player.backToLessons, href: `/${lang}/learn` }}
      />
    );
  }

  return (
    <Session
      key={attempt}
      lang={lang}
      t={courseT}
      course={course}
      premium={premium}
      mode={mode}
      slug={progressSlug(lessonSlug ?? "review", course)}
      items={reviewItems}
      allItems={allItems}
      seed={seedFrom(`${lessonSlug ?? "review"}:${attempt}`)}
      nextLessonSlug={nextLessonSlug}
      onRestart={() => setAttempt((a) => a + 1)}
    />
  );
}

function Session({
  lang,
  t,
  course,
  premium,
  mode,
  slug,
  items,
  allItems,
  seed,
  nextLessonSlug,
  onRestart,
}: {
  lang: Locale;
  t: T;
  course: Course;
  premium: boolean;
  mode: "lesson" | "review";
  /** Progress key: the lesson slug ("review" for reviews), with "tr:" in front in the Turkish course. */
  slug: string;
  items: Item[];
  allItems: Item[];
  seed: number;
  nextLessonSlug?: string;
  onRestart: () => void;
}) {
  const p = t.player;
  const initial = useMemo(
    () => (mode === "lesson" ? buildLesson(items, seed, allItems) : buildReview(items, seed, allItems)),
    [mode, items, seed, allItems],
  );
  const graded = initial.filter((e) => e.kind !== "learn").length;
  // Identifies this run, so a retry of a missed word in the same run doesn't clear it from review.
  const [sessionId] = useState(() => `${slug}:${seed}:${Date.now()}`);

  const [queue, setQueue] = useState<Exercise[]>(initial);
  const [index, setIndex] = useState(0);
  const [retried, setRetried] = useState<Set<string>>(new Set());
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [result, setResult] = useState<{ score: number; streak: Streak } | null>(null);

  // Answers in progress for the current exercise.
  const [choice, setChoice] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [chosenTiles, setChosenTiles] = useState<number[]>([]);

  const exercise = queue[index];
  const isRetry = index >= initial.length;

  // Each new exercise starts at the top of the screen (the question must be visible).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [index, result]);

  const advance = () => {
    setFeedback(null);
    setChoice(null);
    setTyped("");
    setChosenTiles([]);
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      return;
    }
    const score = graded ? Math.round((firstTryCorrect / graded) * 100) : 100;
    finishSession(slug, score, { premium }).then((streak) => {
      setResult({ score, streak });
      void syncWithAccount(); // save to the account in the background (no-op when signed out)
    });
  };

  /** Grade an answer: remember it per word, re-queue one retry for a wrong first try. */
  const grade = (item: Item, correct: boolean, expected: string, accents = false) => {
    void recordAnswer(item.id, correct, sessionId);
    if (!isRetry && correct) setFirstTryCorrect((n) => n + 1);
    if (!correct && !retried.has(item.id)) {
      const retry = retryOf(exercise, items, allItems, seed + index);
      if (retry) {
        setQueue((q) => [...q, retry]);
        setRetried((s) => new Set(s).add(item.id));
      }
    }
    setFeedback({ correct, expected, accents });
  };

  const check = () => {
    if (!exercise || feedback) return;
    if (exercise.kind === "choose") {
      if (!choice) return;
      const expected = exercise.direction === "sq-tr" ? exercise.item.tr : exercise.item.sq;
      grade(exercise.item, choice === expected, expected);
    } else if (exercise.kind === "type") {
      if (!typed.trim()) return;
      const r = checkTyped(typed, exercise.item.sq, course);
      grade(exercise.item, r !== "wrong", exercise.item.sq, r === "accents");
    } else if (exercise.kind === "order") {
      if (!chosenTiles.length) return;
      grade(exercise.item, checkOrder(chosenTiles.map((i) => exercise.tiles[i]), exercise.item.sq, course), exercise.item.sq);
    }
  };

  const onMatchDone = (wrongIds: string[]) => {
    if (exercise?.kind !== "match") return;
    for (const item of exercise.items) void recordAnswer(item.id, !wrongIds.includes(item.id), sessionId);
    const correct = wrongIds.length === 0;
    if (!isRetry && correct) setFirstTryCorrect((n) => n + 1);
    setFeedback({ correct, expected: "" });
  };

  // ---------- Finished ----------
  if (result) {
    return (
      <div className="fade-in flex flex-col items-center gap-6 py-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-on-accent">
          <Check aria-hidden="true" className="h-8 w-8" />
        </div>
        <h2 className="text-[28px] font-bold">{mode === "review" ? p.reviewFinishTitle : p.finishTitle}</h2>
        <div className="grid w-full max-w-sm grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
            <p className="text-[34px] leading-none font-bold tabular-nums">%{result.score}</p>
            <p className="mt-1 text-[13px] text-muted">{p.score}</p>
          </div>
          <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
            <p className="flex items-center justify-center gap-1 text-[34px] leading-none font-bold tabular-nums">
              <Flame aria-hidden="true" className="h-7 w-7 text-accent-text" fill="currentColor" />
              {result.streak.current}
            </p>
            <p className="mt-1 text-[13px] text-muted">{fill(t.streak, { n: result.streak.current })}</p>
          </div>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-2">
          {nextLessonSlug ? (
            <Link
              href={`/${lang}/learn/${nextLessonSlug}`}
              className="pressable inline-flex h-12 items-center justify-center rounded-full bg-accent px-5 text-[17px] font-semibold text-on-accent hover:bg-accent-pressed"
            >
              {p.nextLesson}
            </Link>
          ) : (
            <Link
              href={`/${lang}/learn`}
              className="pressable inline-flex h-12 items-center justify-center rounded-full bg-accent px-5 text-[17px] font-semibold text-on-accent hover:bg-accent-pressed"
            >
              {p.backToLessons}
            </Link>
          )}
          <Button variant="secondary" onClick={onRestart}>
            {p.again}
          </Button>
          {nextLessonSlug && (
            <Link href={`/${lang}/learn`} className="inline-flex h-11 items-center justify-center text-[15px] font-medium text-muted">
              {p.backToLessons}
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (!exercise) return null;

  const progress = Math.round((index / queue.length) * 100);
  const canCheck =
    (exercise.kind === "choose" && !!choice) ||
    (exercise.kind === "type" && !!typed.trim()) ||
    (exercise.kind === "order" && chosenTiles.length > 0);

  return (
    // At least one screen tall (minus header, tab bar and padding), so the action button sits at the
    // bottom like a native app and the site footer stays below the fold during a lesson.
    <div className="flex min-h-[calc(100svh-11rem)] flex-col gap-6">
      {/* Top: exit + progress */}
      <div className="flex items-center gap-3">
        <Link
          href={`/${lang}/learn`}
          aria-label={p.close}
          className="pressable -ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground"
        >
          <X aria-hidden="true" className="h-6 w-6" />
        </Link>
        <div
          role="progressbar"
          aria-label={p.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Exercise */}
      {/* No fixed min-height here: the parent's min-height already keeps the button at the bottom, and a
          floor of its own pushed the button behind the tab bar on short phones (320×568). */}
      <div key={index} className="fade-in flex flex-1 flex-col gap-5">
        {exercise.kind === "learn" && <LearnCard item={exercise.item} lang={lang} t={p} course={course} />}

        {exercise.kind === "choose" && (
          <>
            <h2 className="text-[15px] font-medium text-muted">{exercise.direction === "sq-tr" ? p.chooseMeaning : p.chooseAlbanian}</h2>
            {exercise.direction === "sq-tr" ? (
              <PromptTarget text={exercise.item.sq} t={p} course={course} />
            ) : (
              <p lang={nativeOf(course)} className="text-[28px] leading-tight font-bold">
                {exercise.item.tr}
              </p>
            )}
            <Choose
              options={exercise.options}
              optionLang={exercise.direction === "sq-tr" ? nativeOf(course) : course}
              value={choice}
              onChange={setChoice}
              locked={!!feedback}
              correctOption={exercise.direction === "sq-tr" ? exercise.item.tr : exercise.item.sq}
              label={exercise.direction === "sq-tr" ? p.chooseMeaning : p.chooseAlbanian}
            />
          </>
        )}

        {exercise.kind === "match" && (
          <>
            <h2 className="text-[22px] font-bold">{p.matchTitle}</h2>
            <Match items={exercise.items} t={p} course={course} onDone={onMatchDone} />
          </>
        )}

        {exercise.kind === "order" && (
          <>
            <h2 className="text-[15px] font-medium text-muted">{p.orderTitle}</h2>
            <p lang={nativeOf(course)} className="text-[24px] leading-tight font-bold">
              {exercise.item.tr}
            </p>
            <Order tiles={exercise.tiles} chosen={chosenTiles} onChange={setChosenTiles} locked={!!feedback} t={p} course={course} />
          </>
        )}

        {exercise.kind === "type" && (
          <>
            <h2 className="text-[15px] font-medium text-muted">{p.typeTitle}</h2>
            <p lang={nativeOf(course)} className="text-[28px] leading-tight font-bold">
              {exercise.item.tr}
            </p>
            <TypeAnswer value={typed} onChange={setTyped} onSubmit={check} locked={!!feedback} t={p} course={course} />
          </>
        )}
      </div>

      {/* Bottom: feedback + one primary action */}
      <div className="flex flex-col gap-3">
        <div role="status" aria-live="polite">
          {feedback && (
            <div
              className={`fade-in flex items-start gap-3 rounded-2xl px-4 py-3 ${
                feedback.correct ? "bg-accent-soft text-accent-text" : "bg-surface-2"
              }`}
            >
              {feedback.correct ? (
                <Check aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <X aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
              )}
              <p className="text-[17px] font-semibold">
                {feedback.correct && !feedback.accents ? p.correct : feedback.correct ? p.accents : p.wrong}
                {(!feedback.correct || feedback.accents) && feedback.expected && (
                  <span lang={course} className="ml-1 font-bold text-foreground">
                    {feedback.expected}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {exercise.kind === "learn" ? (
          <Button onClick={advance}>{p.gotIt}</Button>
        ) : feedback ? (
          <Button onClick={advance} autoFocus>
            {p.next}
          </Button>
        ) : exercise.kind !== "match" ? (
          <Button onClick={check} disabled={!canCheck}>
            {p.check}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PlayerSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="skeleton h-11 w-11 rounded-full" />
        <div className="skeleton h-3 flex-1 rounded-full" />
      </div>
      <div className="skeleton h-9 w-2/3 rounded-lg" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-14 rounded-2xl" />
      ))}
    </div>
  );
}
