"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  Languages,
  MessageCircle,
  MessagesSquare,
  Smartphone,
  Sparkles,
  Star,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { localizedPath } from "@/lib/site";
import { SIGNED_IN_HINT } from "@/lib/supabase/cookies";
import { saveLanguage } from "@/lib/language-action";
import { GUIDE_SEEN_KEY, OPEN_GUIDE_EVENT, readPreferences, storageGet, storageSet, updatePreferences, type Direction } from "@/lib/preferences";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/Logo";
import { Confetti } from "@/components/confetti";

type T = Messages["guide"];

const ONE_YEAR = 60 * 60 * 24 * 365;
const SLIDE_ICONS: LucideIcon[] = [MessageCircle, MessagesSquare, Languages, GraduationCap, BookOpen, Smartphone];
/** Step 0 = "who are you", 1…6 = feature tour, 7 = done. */
const LAST = SLIDE_ICONS.length + 1;

/** Pages where the guide never pops up on its own (sign-in, account, payments). */
const QUIET_PATHS = /^\/(tr|sq)\/(app|login|checkout|legal)(\/|$)/;

/**
 * First visit on a device: asks who is learning what (Turkish → Albanian or the other way round)
 * and walks through the main features with tiny interactive demos. The card has its own language
 * toggle, written in the *other* language ("Ndërroni gjuhën" on the Turkish card), so anyone can
 * read it before choosing. Reopened any time from "How to use" (OPEN_GUIDE_EVENT).
 */
export function FirstRunGuide({ lang, texts }: { lang: Locale; texts: Record<Locale, T> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [motion, setMotion] = useState<"next" | "prev">("next");
  const [cardLang, setCardLang] = useState<Locale>(lang);
  const [direction, setDirection] = useState<Direction | null>(null);

  // First visit: open on its own (after the page has painted). Later: only when asked.
  useEffect(() => {
    const signedIn = document.cookie.split("; ").includes(`${SIGNED_IN_HINT}=1`);
    const authLanding = /access_token|error_code/.test(window.location.hash) || /[?&](code|token_hash)=/.test(window.location.search);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!storageGet(GUIDE_SEEN_KEY) && !signedIn && !authLanding && !QUIET_PATHS.test(window.location.pathname)) {
      timer = setTimeout(() => {
        setStep(0);
        setOpen(true);
      }, 450);
    }
    const reopen = (e: Event) => {
      const detail = (e as CustomEvent<{ step?: number } | undefined>).detail;
      setDirection(readPreferences().direction);
      setCardLang(document.documentElement.lang === "sq" ? "sq" : "tr");
      setMotion("next");
      setStep(detail?.step ?? 1);
      setOpen(true);
    };
    window.addEventListener(OPEN_GUIDE_EVENT, reopen);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(OPEN_GUIDE_EVENT, reopen);
    };
  }, []);

  const go = useCallback((to: number) => {
    setStep((from) => {
      const next = Math.max(0, Math.min(LAST, to));
      setMotion(next >= from ? "next" : "prev");
      return next;
    });
  }, []);

  /** Close and remember. Switches the site to the language the card was read in. */
  const finish = useCallback(
    (destination?: "home" | "signup") => {
      storageSet(GUIDE_SEEN_KEY, "1");
      if (direction) updatePreferences({ direction });
      setOpen(false);
      const changeLang = cardLang !== lang;
      if (changeLang) {
        document.cookie = `${LOCALE_COOKIE}=${cardLang}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
        // Signed in (tour reopened from the dashboard): the account remembers it too.
        if (document.cookie.split("; ").includes(`${SIGNED_IN_HINT}=1`)) void saveLanguage(cardLang).catch(() => {});
      }
      if (destination === "signup") router.push(`/${cardLang}/login?mode=signup`);
      else if (destination === "home") router.push(`/${cardLang}`);
      // Read the path only now (not with usePathname: this lives in the root layout, outside Suspense).
      else if (changeLang) router.push(localizedPath(window.location.pathname, cardLang));
    },
    [cardLang, direction, lang, router],
  );

  if (!open) return null;
  return (
    <GuideDialog
      t={texts[cardLang]}
      other={texts[cardLang === "tr" ? "sq" : "tr"]}
      cardLang={cardLang}
      step={step}
      motion={motion}
      direction={direction}
      onToggleLang={() => setCardLang((l) => (l === "tr" ? "sq" : "tr"))}
      onPick={(d) => {
        setDirection(d);
        setCardLang(d === "tr-sq" ? "tr" : "sq"); // show the rest in the language they speak
        setTimeout(() => go(1), 280);
      }}
      go={go}
      finish={finish}
    />
  );
}

function GuideDialog({
  t,
  other,
  cardLang,
  step,
  motion,
  direction,
  onToggleLang,
  onPick,
  go,
  finish,
}: {
  t: T;
  other: T;
  cardLang: Locale;
  step: number;
  motion: "next" | "prev";
  direction: Direction | null;
  onToggleLang: () => void;
  onPick: (d: Direction) => void;
  go: (to: number) => void;
  finish: (destination?: "home" | "signup") => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const otherLang: Locale = cardLang === "tr" ? "sq" : "tr";

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight" && step > 0 && step < LAST) go(step + 1);
      if (e.key === "ArrowLeft" && step > 1) go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, step]);

  return (
    <dialog
      ref={ref}
      lang={cardLang}
      aria-label={t.dialogLabel}
      onCancel={(e) => {
        e.preventDefault(); // Esc = skip (and remember), not a silent close
        finish();
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start == null || end == null || step === 0) return;
        if (end - start < -50 && step < LAST) go(step + 1);
        if (end - start > 50 && step > 1) go(step - 1);
      }}
      className="sheet m-auto mb-0 max-h-[94dvh] w-full max-w-md overflow-x-hidden overflow-y-auto rounded-t-[28px] bg-background p-0 text-foreground shadow-float sm:mb-auto sm:rounded-[28px]"
    >
      <div className="relative flex min-h-[min(640px,94dvh)] flex-col px-5 pt-4 pb-5">
        {/* Header: language toggle (in the other language) + skip */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggleLang}
            lang={otherLang}
            aria-label={other.switchLang}
            className="pressable flex h-10 items-center gap-2 rounded-full bg-surface py-1 pr-3.5 pl-1 text-[14px] font-semibold shadow-card ring-1 ring-hairline hover:bg-surface-2"
          >
            <LangBadge code={otherLang} />
            {other.switchLang}
          </button>
          {step < LAST && (
            <button
              type="button"
              onClick={() => finish()}
              className="pressable flex h-10 items-center gap-1 rounded-full px-3 text-[15px] font-medium text-muted hover:bg-surface-2 hover:text-foreground"
            >
              {t.skip}
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>

        <div key={`${step}-${cardLang}`} className={`flex flex-1 flex-col ${motion === "next" ? "slide-next" : "slide-prev"}`}>
          {step === 0 && <AskStep t={t} direction={direction} onPick={onPick} />}
          {step > 0 && step < LAST && <TourStep t={t} index={step - 1} />}
          {step === LAST && <DoneStep t={t} finish={finish} />}
        </div>

        {step > 0 && step < LAST && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => go(step - 1)} aria-label={t.back} className="h-12 w-12 shrink-0 px-0">
              <ArrowLeft aria-hidden="true" className="h-5 w-5 shrink-0" />
            </Button>
            <Dots t={t} step={step} go={go} />
            <Button onClick={() => go(step + 1)} className="h-12 pr-4 pl-5">
              {t.next}
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </dialog>
  );
}

function LangBadge({ code }: { code: Locale }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold tracking-wide ${
        code === "tr" ? "bg-brand-red text-white" : "bg-brand-ink text-brand-paper ring-1 ring-brand-gold/60"
      }`}
    >
      {code.toUpperCase()}
    </span>
  );
}

function Dots({ t, step, go }: { t: T; step: number; go: (to: number) => void }) {
  const total = SLIDE_ICONS.length;
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={t.step.replace("{n}", String(step)).replace("{total}", String(total))}>
      {SLIDE_ICONS.map((_, i) => {
        const active = i + 1 === step;
        return (
          <button
            key={i}
            type="button"
            onClick={() => go(i + 1)}
            aria-label={t.step.replace("{n}", String(i + 1)).replace("{total}", String(total))}
            aria-current={active ? "step" : undefined}
            className="flex h-6 items-center"
          >
            <span
              className={`block h-2 rounded-full transition-all duration-300 ${active ? "w-6 bg-accent" : i + 1 < step ? "w-2 bg-accent/40" : "w-2 bg-foreground/15"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ step 0: who are you?

function AskStep({ t, direction, onPick }: { t: T; direction: Direction | null; onPick: (d: Direction) => void }) {
  const options: { value: Direction; title: string; body: string; from: Locale; to: Locale }[] = [
    { value: "tr-sq", title: t.trLearnerTitle, body: t.trLearnerBody, from: "tr", to: "sq" },
    { value: "sq-tr", title: t.sqLearnerTitle, body: t.sqLearnerBody, from: "sq", to: "tr" },
  ];
  return (
    <div className="flex flex-1 flex-col">
      <div className="relative mx-auto mt-6 flex h-28 w-full items-center justify-center">
        <span className="float absolute top-1 left-[16%] rounded-2xl rounded-bl-sm bg-brand-red px-3 py-1.5 text-[15px] font-semibold text-white shadow-float" lang="tr">
          Merhaba
        </span>
        <span
          style={{ "--i": 1 } as CSSProperties}
          className="float absolute right-[14%] bottom-1 rounded-2xl rounded-br-sm bg-brand-ink px-3 py-1.5 text-[15px] font-semibold text-brand-paper shadow-float ring-1 ring-brand-gold/50"
          lang="sq"
        >
          Mirëdita
        </span>
        <span className="pop-in">
          <LogoMark height={60} />
        </span>
      </div>
      <p className="mt-4 text-center text-[15px] font-semibold text-accent-text">{t.hello}</p>
      <h2 className="mt-1 text-center text-[28px] leading-tight font-bold">{t.askTitle}</h2>
      <p className="mt-1 text-center text-[15px] text-muted">{t.askBody}</p>

      <div role="radiogroup" aria-label={t.askTitle} className="mt-5 flex flex-col gap-3">
        {options.map((o, i) => {
          const selected = direction === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onPick(o.value)}
              style={{ "--i": i + 2 } as CSSProperties}
              className={`fade-in pressable group flex items-center gap-4 rounded-2xl p-4 text-left ring-1 transition-shadow ${
                selected ? "bg-accent-soft ring-2 ring-accent-text" : "bg-surface shadow-card ring-hairline hover:ring-accent-text/40"
              }`}
            >
              <span className="flex shrink-0 items-center">
                <LangBadge code={o.from} />
                <ArrowRight aria-hidden="true" className="mx-0.5 h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
                <LangBadge code={o.to} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold">{o.title}</span>
                <span className="block text-[14px] leading-snug text-muted">{o.body}</span>
              </span>
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ${selected ? "bg-accent text-on-accent ring-accent" : "ring-hairline"}`}
              >
                {selected && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-auto pt-4 text-center text-[13px] text-muted">{t.chooseHint}</p>
    </div>
  );
}

// ------------------------------------------------------------------ steps 1–6: tour

function TourStep({ t, index }: { t: T; index: number }) {
  const slide = t.slides[index];
  const Icon = SLIDE_ICONS[index];
  const demos: ReactNode[] = [
    <FlipDemo key="flip" t={t} />,
    <RepliesDemo key="replies" t={t} />,
    <TranslateDemo key="translate" t={t} />,
    <QuizDemo key="quiz" t={t} />,
    <SlangDemo key="slang" t={t} />,
    <OfflineDemo key="offline" />,
  ];
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-5 flex items-center gap-3">
        <span className="pop-in flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent shadow-float">
          <Icon aria-hidden="true" className="h-6 w-6" />
        </span>
        <h2 className="text-[24px] leading-tight font-bold">{slide.title}</h2>
      </div>
      <p className="mt-3 text-[16px] leading-relaxed text-body">{slide.body}</p>

      <div className="relative mt-5 flex min-h-[188px] flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl bg-surface-2 p-4 ring-1 ring-hairline">
        <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-accent-text shadow-card">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          {t.demoTry}
        </span>
        {demos[index]}
      </div>

      <p className="mt-3 flex items-start gap-2 rounded-2xl bg-accent-soft px-3.5 py-2.5 text-[14px] leading-snug text-foreground">
        <Star aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
        {slide.tip}
      </p>
    </div>
  );
}

function FlipDemo({ t }: { t: T }) {
  const [flipped, setFlipped] = useState(false);
  const [pinned, setPinned] = useState(false);
  return (
    <div className="flex w-full max-w-[260px] flex-col items-center gap-2">
      <div className="relative w-full">
        <button type="button" onClick={() => setFlipped((f) => !f)} data-flipped={flipped} className="flip block w-full" aria-pressed={flipped}>
          <span className="flip-inner">
            <span className="flex min-h-24 flex-col items-center justify-center rounded-2xl bg-surface p-4 shadow-float ring-1 ring-hairline">
              <span className="text-[28px] font-bold">{t.demoFront}</span>
            </span>
            <span className="flip-back flex min-h-24 flex-col items-center justify-center rounded-2xl bg-accent p-4 text-on-accent shadow-float">
              <span className="text-[24px] font-bold">{t.demoBack}</span>
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setPinned((p) => !p)}
          aria-pressed={pinned}
          aria-label={t.slides[0].tip}
          className="pressable absolute -top-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-float ring-1 ring-hairline"
        >
          <Star aria-hidden="true" className={`h-5 w-5 ${pinned ? "pop-in fill-brand-gold text-brand-gold" : "text-muted"}`} />
        </button>
      </div>
      <p className="text-[13px] text-muted">{t.demoTap} ↻</p>
    </div>
  );
}

function RepliesDemo({ t }: { t: T }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-3">
      <div className="grid w-full grid-cols-3 gap-2">
        {t.demoReplies.map((r, i) => (
          <button
            key={r}
            type="button"
            onClick={() => setPicked(i)}
            aria-pressed={picked === i}
            style={{ "--i": i } as CSSProperties}
            className={`fade-in pressable min-h-12 rounded-2xl px-2 text-[16px] font-semibold ${
              picked === i ? "bg-accent-soft text-accent-text ring-2 ring-accent-text" : "bg-surface shadow-card ring-1 ring-hairline"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="min-h-12">
        {picked !== null && (
          <p key={picked} className="pop-in rounded-2xl rounded-tl-sm bg-brand-ink px-4 py-2.5 text-[17px] font-semibold text-brand-paper">
            → {t.demoRepliesTr[picked]}
          </p>
        )}
      </div>
    </div>
  );
}

function TranslateDemo({ t }: { t: T }) {
  const [typed, setTyped] = useState(0);
  const [run, setRun] = useState(0);
  const full = t.demoTranslateIn;
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
    let n = reduce ? full.length - 1 : -1;
    const timer = setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= full.length) clearInterval(timer);
    }, reduce ? 0 : 70);
    return () => clearInterval(timer);
  }, [full, run]);
  const done = typed >= full.length;
  return (
    <button type="button" onClick={() => setRun((r) => r + 1)} className="flex w-full max-w-[300px] flex-col gap-2 text-left">
      <span className="rounded-2xl bg-surface px-4 py-3 text-[17px] shadow-card ring-1 ring-hairline">
        {full.slice(0, typed)}
        {!done && <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-accent" />}
      </span>
      <span className={`flex items-center gap-2 transition-opacity duration-300 ${done ? "opacity-100" : "opacity-0"}`}>
        <ArrowRight aria-hidden="true" className="h-4 w-4 rotate-90 text-accent-text" />
        <span className="flex-1 rounded-2xl bg-accent px-4 py-3 text-[17px] font-semibold text-on-accent shadow-float">{t.demoTranslateOut}</span>
      </span>
    </button>
  );
}

function QuizDemo({ t }: { t: T }) {
  const [answer, setAnswer] = useState<"right" | "wrong" | null>(null);
  const [burst, setBurst] = useState(0);
  const options = [
    { key: "wrong" as const, label: t.quizWrong },
    { key: "right" as const, label: t.quizRight },
  ];
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-3">
      {answer === "right" && <Confetti burstKey={burst} pieces={28} originY="20%" />}
      <p className="text-center text-[17px] font-semibold">{t.quizQuestion}</p>
      <div className="grid w-full grid-cols-2 gap-2">
        {options.map((o) => {
          const state = answer === o.key ? o.key : null;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                setAnswer(o.key);
                if (o.key === "right") setBurst((b) => b + 1);
              }}
              className={`pressable min-h-12 rounded-2xl px-2 text-[16px] font-semibold ring-1 ${
                state === "right"
                  ? "bg-emerald-600 text-white ring-emerald-600"
                  : state === "wrong"
                    ? "wiggle bg-accent-soft text-accent-text ring-accent-text"
                    : "bg-surface shadow-card ring-hairline"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="min-h-6 text-[15px] font-semibold">
        {answer === "right" && <span className="pop-in inline-block text-emerald-700 dark:text-emerald-400">{t.quizCorrect}</span>}
        {answer === "wrong" && <span className="text-accent-text">{t.quizTryAgain}</span>}
      </p>
    </div>
  );
}

function SlangDemo({ t }: { t: T }) {
  const [shown, setShown] = useState<Set<number>>(new Set());
  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      {t.demoSlang.map((s, i) => {
        const open = shown.has(i);
        return (
          <button
            key={s.w}
            type="button"
            aria-expanded={open}
            onClick={() => setShown((prev) => new Set(prev).add(i))}
            style={{ "--i": i } as CSSProperties}
            className={`float pressable flex flex-col items-center rounded-2xl px-4 py-2.5 shadow-card ring-1 ${
              open ? "bg-accent text-on-accent ring-accent" : "bg-surface ring-hairline"
            }`}
          >
            <span lang="sq" className="text-[20px] font-bold">
              {s.w}
            </span>
            <span className={`text-[13px] font-medium ${open ? "opacity-100" : "opacity-60"}`}>{open ? s.m : "?"}</span>
          </button>
        );
      })}
    </div>
  );
}

function OfflineDemo() {
  return (
    <div className="relative flex h-40 w-full items-center justify-center">
      <div className="pop-in flex h-36 w-20 flex-col items-center justify-center gap-2 rounded-[18px] bg-brand-ink p-2 shadow-float ring-4 ring-surface">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red">
          <MessageCircle aria-hidden="true" className="h-5 w-5 text-white" />
        </span>
        <span className="h-1.5 w-10 rounded-full bg-white/30" />
        <span className="h-1.5 w-7 rounded-full bg-white/20" />
      </div>
      <span className="float absolute top-3 left-[18%] flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-float ring-1 ring-hairline">
        <WifiOff aria-hidden="true" className="h-5 w-5 text-accent-text" />
      </span>
      <span
        style={{ "--i": 2 } as CSSProperties}
        className="float absolute right-[18%] bottom-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-float ring-1 ring-hairline"
      >
        <Check aria-hidden="true" className="h-5 w-5 text-emerald-600" strokeWidth={3} />
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ done

function DoneStep({ t, finish }: { t: T; finish: (destination?: "home" | "signup") => void }) {
  // Only rendered in the browser (the dialog opens after hydration), so reading the cookie here is safe.
  const [signedIn] = useState(() => document.cookie.split("; ").includes(`${SIGNED_IN_HINT}=1`));
  return (
    <div className="relative flex flex-1 flex-col items-center text-center">
      <Confetti burstKey={1} pieces={44} originY="18%" />
      <span className="pop-in mt-10 flex h-20 w-20 items-center justify-center rounded-[26px] bg-accent text-on-accent shadow-float">
        <Check aria-hidden="true" className="h-10 w-10" strokeWidth={3} />
      </span>
      <h2 className="mt-5 text-[30px] font-bold">{t.doneTitle}</h2>
      <p className="mt-2 max-w-xs text-[15px] text-muted">{t.doneBody}</p>
      <div className="mt-auto flex w-full flex-col gap-2 pt-8">
        <Button onClick={() => finish("home")} autoFocus>
          <MessageCircle aria-hidden="true" className="h-5 w-5" />
          {t.start}
        </Button>
        {!signedIn && (
          <>
            <Button variant="secondary" onClick={() => finish("signup")}>
              {t.signUp}
            </Button>
            <p className="text-[13px] text-muted">{t.signUpHint}</p>
          </>
        )}
      </div>
    </div>
  );
}

/** "How to use?" link: reopens the tour from anywhere (e.g. the footer). */
export function OpenGuideButton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_GUIDE_EVENT, { detail: { step: 1 } }))} className={className}>
      {label}
    </button>
  );
}
