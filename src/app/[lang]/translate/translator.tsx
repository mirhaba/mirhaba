"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeftRight, Check, CircleAlert, Copy, Flag, LogIn, WifiOff } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { submitCorrection, translateText, type TranslateError } from "./actions";

type T = Messages["translate"];
type Direction = "tr-sq" | "sq-tr";
type Variant = "standard" | "kosovan";
type Result = { source: string; direction: Direction; translation: string; notes: { term: string; meaning: string }[] };

export function Translator({
  lang,
  t,
  signedIn,
  freeLimit,
  maxChars,
}: {
  lang: Locale;
  t: T;
  signedIn: boolean;
  freeLimit: number;
  maxChars: number;
}) {
  // A Turkish UI most likely wants Turkish → Albanian; an Albanian UI the other way round.
  const [direction, setDirection] = useState<Direction>(lang === "tr" ? "tr-sq" : "sq-tr");
  const [variant, setVariant] = useState<Variant>("kosovan");
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<TranslateError | null>(null);
  const [remaining, setRemaining] = useState<number | null | undefined>(undefined);
  const [online, setOnline] = useState(true);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const timer = setTimeout(update, 0);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // On a phone the answer lands below the fold: bring it into view so it doesn't look like nothing happened.
  useEffect(() => {
    if (!result) return;
    // Wait a frame so the card has its full height, then scroll only if part of it is hidden
    // (the bottom tab bar covers the last ~80px on phones).
    const frame = requestAnimationFrame(() => {
      const el = resultRef.current;
      if (!el || el.getBoundingClientRect().bottom <= window.innerHeight - 80) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [result]);

  const submit = () => {
    if (pending || !signedIn) return;
    if (!text.trim()) {
      setError("empty");
      textareaRef.current?.focus();
      return;
    }
    setError(null);
    const source = text;
    const dir = direction;
    startTransition(async () => {
      const res = await translateText({ lang, text: source, direction: dir, variant });
      if ("remaining" in res && res.remaining !== undefined) setRemaining(res.remaining);
      if (res.ok) {
        setResult({ source, direction: dir, translation: res.translation, notes: res.notes });
      } else {
        setError(res.error);
        setResult(null);
      }
    });
  };

  const swap = () => {
    setDirection((d) => (d === "tr-sq" ? "sq-tr" : "tr-sq"));
    // Translating back: the old result becomes the new input.
    if (result) {
      setText(result.translation);
      setResult(null);
    }
    setError(null);
  };

  const errorText = (e: TranslateError) => t.errors[e].replace("{max}", String(maxChars));
  const inputLabel = direction === "tr-sq" ? t.inputLabelTr : t.inputLabelSq;

  return (
    <div className="flex flex-col gap-4">
      {/* Direction: one segmented control; switching sides also flips the last result into the input. */}
      <div role="radiogroup" aria-label={t.direction} className="flex rounded-xl bg-surface-2 p-1">
        {(["tr-sq", "sq-tr"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={direction === d}
            onClick={() => direction !== d && swap()}
            className={`pressable flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-[14px] font-semibold sm:text-[15px] ${
              direction === d ? "bg-surface text-foreground shadow-card" : "text-muted"
            }`}
          >
            {/* The label already says the direction; on phones the icon would push it into "Arnav…". */}
            {direction === d && <ArrowLeftRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 text-accent-text sm:block" />}
            <span className="truncate">{d === "tr-sq" ? t.trToSq : t.sqToTr}</span>
          </button>
        ))}
      </div>

      {direction === "tr-sq" && (
        <div className="fade-in flex items-center gap-3">
          <span id="variant-label" className="text-[13px] font-medium text-muted">
            {t.style}
          </span>
          <div role="radiogroup" aria-labelledby="variant-label" className="flex rounded-xl bg-surface-2 p-1">
            {(["kosovan", "standard"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={variant === v}
                onClick={() => setVariant(v)}
                className={`pressable h-9 rounded-lg px-4 text-[15px] font-semibold ${
                  variant === v ? "bg-surface text-foreground shadow-card" : "text-muted"
                }`}
              >
                {v === "kosovan" ? t.kosovan : t.standard}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-3"
      >
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="translate-input" className="text-[13px] font-medium text-muted">
              {inputLabel}
            </label>
            <span className="text-[13px] text-muted tabular-nums" aria-hidden="true">
              {t.chars.replace("{n}", String(text.length)).replace("{max}", String(maxChars))}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            id="translate-input"
            lang={direction === "tr-sq" ? "tr" : "sq"}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error === "empty" || error === "tooLong") setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            maxLength={maxChars}
            rows={4}
            placeholder={direction === "tr-sq" ? t.placeholderTr : t.placeholderSq}
            aria-invalid={error === "empty" || error === "tooLong" || undefined}
            aria-describedby={error ? "translate-error" : undefined}
            className="block w-full resize-y rounded-2xl bg-surface p-4 text-[17px] leading-relaxed shadow-card ring-1 ring-hairline transition-shadow duration-150 outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent-text/40 aria-invalid:ring-2 aria-invalid:ring-accent-text"
          />
          {error && (
            <p id="translate-error" role="alert" className="fade-in mt-2 flex items-start gap-1.5 text-[15px] font-medium text-accent-text">
              <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {errorText(error)}
                {error === "consent" && (
                  <>
                    {" "}
                    <Link href={`/${lang}/app?next=${encodeURIComponent(`/${lang}/translate`)}`} className="underline underline-offset-2">
                      {t.consentCta}
                    </Link>
                  </>
                )}
              </span>
            </p>
          )}
        </div>

        {!online && (
          <p className="fade-in flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-[15px] text-muted">
            <WifiOff aria-hidden="true" className="h-5 w-5 shrink-0" />
            {t.offline}
          </p>
        )}

        {signedIn ? (
          <>
            <Button type="submit" loading={pending} disabled={!online || !text.trim()}>
              {pending ? t.translating : t.submit}
            </Button>
            {typeof remaining === "number" && (
              <p className="text-center text-[13px] text-muted" aria-live="polite">
                {remaining === 1 ? t.leftOne : t.left.replace("{n}", String(remaining))}
              </p>
            )}
          </>
        ) : (
          <div className="fade-in flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
                <LogIn aria-hidden="true" className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{t.signInTitle}</p>
                <p className="text-[15px] text-muted">{t.signInBody.replace("{n}", String(freeLimit))}</p>
              </div>
            </div>
            <Link
              href={`/${lang}/login?next=${encodeURIComponent(`/${lang}/translate`)}`}
              className="pressable inline-flex h-12 items-center justify-center rounded-full bg-accent px-5 text-[17px] font-semibold text-on-accent hover:bg-accent-pressed"
            >
              {t.signIn}
            </Link>
          </div>
        )}
      </form>

      <div ref={resultRef} aria-live="polite" className="scroll-mt-20">
        {pending ? <ResultSkeleton /> : result && <ResultCard key={result.translation} result={result} t={t} />}
      </div>
    </div>
  );
}

function ResultCard({ result, t }: { result: Result; t: T }) {
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, startSending] = useTransition();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.translation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };

  return (
    <section aria-labelledby="result-heading" className="fade-in overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h2 id="result-heading" className="text-[13px] font-medium text-muted">
            {t.result}
          </h2>
          <button
            type="button"
            onClick={copy}
            className="pressable -mr-2 inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold text-accent-text hover:bg-accent-soft"
          >
            {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
            {copied ? t.copied : t.copy}
          </button>
        </div>
        <p lang={result.direction === "tr-sq" ? "sq" : "tr"} className="mt-1 text-[22px] leading-snug font-semibold break-words select-text">
          {result.translation}
        </p>
      </div>

      {result.notes.length > 0 && (
        <div className="border-t border-hairline px-4 py-3">
          <h3 className="text-[13px] font-medium text-muted">{t.notes}</h3>
          <ul className="mt-1 space-y-1">
            {result.notes.map((n) => (
              <li key={n.term} className="text-[15px]">
                <span className="font-semibold">{n.term}</span> = {n.meaning}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-hairline px-4 py-2">
        {sent ? (
          <p role="status" className="fade-in flex items-center gap-2 py-2 text-[15px] text-muted">
            <Check aria-hidden="true" className="h-4 w-4 text-accent-text" />
            {t.wrongThanks}
          </p>
        ) : reporting ? (
          <form
            className="fade-in flex flex-col gap-2 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!suggestion.trim()) return;
              startSending(async () => {
                const res = await submitCorrection({
                  direction: result.direction,
                  source: result.source,
                  translation: result.translation,
                  suggestion,
                });
                if (res.ok) setSent(true);
              });
            }}
          >
            <label htmlFor="correction" className="text-[13px] font-medium text-muted">
              {t.wrongLabel}
            </label>
            <textarea
              id="correction"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder={t.wrongPlaceholder}
              className="w-full rounded-xl bg-surface-2 p-3 text-[17px] outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent-text/40"
            />
            <Button type="submit" variant="secondary" loading={sending} disabled={!suggestion.trim()} className="self-end">
              {t.wrongSend}
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="pressable inline-flex h-11 items-center gap-2 text-[15px] text-muted hover:text-foreground"
          >
            <Flag aria-hidden="true" className="h-4 w-4" />
            {t.wrong}
          </button>
        )}
      </div>
    </section>
  );
}

function ResultSkeleton() {
  return (
    <div aria-hidden="true" className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
      <div className="skeleton h-3.5 w-16 rounded" />
      <div className="mt-3 space-y-2">
        <div className="skeleton h-6 w-11/12 rounded" />
        <div className="skeleton h-6 w-3/5 rounded" />
      </div>
    </div>
  );
}
