"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Check, GraduationCap, Languages, LayoutDashboard, Star } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { sectionHref } from "@/lib/site";
import {
  DAILY_GOALS,
  GUIDE_SEEN_KEY,
  readPreferences,
  storageGet,
  storageSet,
  updatePreferences,
  WELCOME_PENDING_KEY,
} from "@/lib/preferences";
import { Button } from "@/components/ui/button";
import { Confetti } from "@/components/confetti";

/** Fired by the consent step right after the first sign-in, so the welcome opens without a reload. */
export const WELCOME_EVENT = "mirhaba:welcome";

type Props = {
  lang: Locale;
  t: Messages["welcome"];
  prefs: Pick<Messages["prefs"], "goalNames" | "lessonsN">;
};

/**
 * Shown once, right after someone creates an account (the one-time consent step sets the flag).
 * Celebrates, asks two optional things (name for the greeting, daily goal) and suggests first steps.
 */
export function SignupWelcome(props: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      if (storageGet(WELCOME_PENDING_KEY) === "1") setOpen(true);
    };
    const timer = setTimeout(check, 300);
    window.addEventListener(WELCOME_EVENT, check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(WELCOME_EVENT, check);
    };
  }, []);

  if (!open) return null;
  return (
    <WelcomeDialog
      {...props}
      onClose={() => {
        storageSet(WELCOME_PENDING_KEY, null);
        storageSet(GUIDE_SEEN_KEY, "1"); // they're in; the first-visit tour shouldn't pop up later
        setOpen(false);
      }}
    />
  );
}

function WelcomeDialog({ lang, t, prefs, onClose }: Props & { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(() => readPreferences().nickname);
  const [goal, setGoal] = useState(() => readPreferences().dailyGoal);
  const [burst, setBurst] = useState(1);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const save = () => updatePreferences({ nickname: name.trim(), dailyGoal: goal });

  const firstSteps = [
    { key: "learn" as const, href: sectionHref("learn", lang), Icon: GraduationCap },
    { key: "pin" as const, href: sectionHref("quickTalk", lang), Icon: Star },
    { key: "translate" as const, href: sectionHref("translate", lang), Icon: Languages },
  ];

  return (
    <dialog
      ref={ref}
      aria-label={t.dialogLabel}
      onClose={onClose}
      className="sheet m-auto mb-0 max-h-[94dvh] w-full max-w-md overflow-x-hidden overflow-y-auto rounded-t-[28px] bg-background p-0 text-foreground shadow-float sm:mb-auto sm:rounded-[28px]"
    >
      <div className="relative px-5 pt-6 pb-5">
        {step === 1 ? (
          <form
            key="one"
            className="slide-next flex flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              save();
              setStep(2);
            }}
          >
            <Confetti burstKey={burst} pieces={48} originY="12%" />
            <button
              type="button"
              onClick={() => setBurst((b) => b + 1)}
              aria-hidden="true"
              tabIndex={-1}
              className="pop-in mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-accent text-[40px] shadow-float"
            >
              🎉
            </button>
            <h2 className="mt-4 text-center text-[28px] leading-tight font-bold">{t.title}</h2>
            <p className="mt-1 text-center text-[15px] text-muted">{t.body}</p>

            <label htmlFor="welcome-name" className="mt-6 text-[13px] font-medium text-muted">
              {t.nameLabel}
            </label>
            <input
              id="welcome-name"
              value={name}
              maxLength={40}
              autoComplete="given-name"
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              className="mt-1.5 h-12 rounded-2xl bg-surface px-4 text-[17px] shadow-card ring-1 ring-hairline outline-none focus:ring-2 focus:ring-accent-text"
            />

            <p id="welcome-goal" className="mt-5 text-[13px] font-medium text-muted">
              {t.goalLabel}
            </p>
            <div role="radiogroup" aria-labelledby="welcome-goal" className="mt-1.5 grid grid-cols-4 gap-2">
              {DAILY_GOALS.map((g, i) => (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={goal === g}
                  onClick={() => setGoal(g)}
                  style={{ "--i": i } as CSSProperties}
                  className={`fade-in pressable flex flex-col items-center rounded-2xl px-1 py-2.5 ring-1 ${
                    goal === g ? "bg-accent text-on-accent ring-accent" : "bg-surface shadow-card ring-hairline"
                  }`}
                >
                  <span className="text-[20px] font-bold">{g}</span>
                  <span className={`text-[12px] font-medium ${goal === g ? "text-on-accent/90" : "text-muted"}`}>
                    {prefs.goalNames[String(g) as keyof typeof prefs.goalNames]}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[13px] text-muted">{prefs.lessonsN.replace("{n}", String(goal))}</p>

            <div className="mt-5 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
              <p className="text-[13px] font-medium text-muted">{t.perksTitle}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {t.perks.map((perk, i) => (
                  <li key={perk} style={{ "--i": i + 3 } as CSSProperties} className="fade-in flex items-center gap-2.5 text-[15px]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>

            <Button type="submit" className="mt-6">
              {t.continue}
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Button>
          </form>
        ) : (
          <div key="two" className="slide-next flex flex-col">
            <h2 className="text-[26px] leading-tight font-bold">{t.stepsTitle}</h2>
            <p className="mt-1 text-[15px] text-muted">{t.stepsBody}</p>
            <ul className="mt-5 flex flex-col gap-3">
              {firstSteps.map(({ key, href, Icon }, i) => (
                <li key={key} style={{ "--i": i } as CSSProperties} className="fade-in">
                  <Link
                    href={href}
                    onClick={() => ref.current?.close()}
                    className="pressable group flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline hover:ring-accent-text/40"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-text">
                      <Icon aria-hidden="true" className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-semibold">{t.steps[key].title}</span>
                      <span className="block text-[14px] text-muted">{t.steps[key].body}</span>
                    </span>
                    <ArrowRight aria-hidden="true" className="h-5 w-5 text-muted transition-transform group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={`/${lang}/app`}
              onClick={() => ref.current?.close()}
              autoFocus
              className="pressable mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-surface px-5 text-[17px] font-semibold text-foreground shadow-card ring-1 ring-hairline hover:bg-surface-2 dark:bg-surface-2"
            >
              <LayoutDashboard aria-hidden="true" className="h-5 w-5" />
              {t.toDashboard}
            </Link>
          </div>
        )}
      </div>
    </dialog>
  );
}
