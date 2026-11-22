"use client";

import { useEffect, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, CircleHelp, Compass, Monitor, Moon, RotateCcw, Sun, Volume2 } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import {
  DAILY_GOALS,
  DEFAULT_PREFERENCES,
  OPEN_GUIDE_EVENT,
  updatePreferences,
  usePreferences,
  type Direction,
  type SpeechSpeed,
  type Theme,
} from "@/lib/preferences";
import { canSpeakAlbanian, speakAlbanian } from "@/components/quick-talk/speak";
import { Switch } from "@/components/ui/switch";
import { Toast } from "@/components/toast";
import { setLanguage } from "./actions";

type T = Messages["prefs"];

const LANGUAGE_NAME: Record<Locale, string> = { tr: "Türkçe", sq: "Shqip" };

/**
 * Personal preferences. Everything applies instantly and is saved on this device; the interface
 * language is also saved on the account (it decides the language of emails and sign-in links).
 */
export function PreferencesPanel({
  lang,
  t,
  languageLabel,
  tourLabel,
  tourHint,
  saveError,
}: {
  lang: Locale;
  t: T;
  languageLabel: string;
  tourLabel: string;
  tourHint: string;
  saveError: string;
}) {
  const prefs = usePreferences();
  const [toast, setToast] = useState("");
  // null = untouched: show the saved value (which only arrives after hydration).
  const [draft, setDraft] = useState<string | null>(null);
  const nickname = draft ?? prefs.nickname;
  const [pending, startTransition] = useTransition();
  const [voice, setVoice] = useState(true);

  useEffect(() => {
    const check = () => setVoice(canSpeakAlbanian());
    const timer = setTimeout(check, 0);
    if (typeof speechSynthesis !== "undefined") speechSynthesis.addEventListener?.("voiceschanged", check);
    return () => {
      clearTimeout(timer);
      if (typeof speechSynthesis !== "undefined") speechSynthesis.removeEventListener?.("voiceschanged", check);
    };
  }, []);

  const save = (patch: Parameters<typeof updatePreferences>[0]) => {
    updatePreferences(patch);
    setToast(t.saved);
  };

  const changeLanguage = (code: Locale) => {
    if (code === lang) return;
    startTransition(async () => {
      const result = await setLanguage(code);
      if (result && !result.ok) setToast(saveError); // success redirects
    });
  };

  const uiForDirection: Locale = prefs.direction === "tr-sq" ? "tr" : "sq";

  return (
    <div className="flex flex-col gap-7">
      <p className="fade-in -mb-2 px-1 text-[13px] text-muted">{t.savedHere}</p>

      {/* Profile */}
      <Group title={t.profileTitle} i={0}>
        <div className="px-4 py-3">
          <label htmlFor="pref-nickname" className="block text-[17px]">
            {t.nicknameLabel}
          </label>
          <input
            id="pref-nickname"
            value={nickname}
            maxLength={40}
            autoComplete="given-name"
            placeholder={t.nicknamePlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (nickname.trim() !== prefs.nickname) save({ nickname: nickname.trim() });
              setDraft(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="mt-2 h-11 w-full rounded-xl bg-surface-2 px-3.5 text-[17px] outline-none focus:ring-2 focus:ring-accent-text"
          />
          <p className="mt-1.5 text-[13px] text-muted">{t.nicknameHint}</p>
        </div>
      </Group>

      {/* Learning */}
      <Group title={t.learningTitle} i={1}>
        <div className="p-4">
          <p id="pref-direction" className="text-[17px]">
            {t.directionLabel}
          </p>
          <div role="radiogroup" aria-labelledby="pref-direction" className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                { value: "tr-sq", title: t.directionTrSq, hint: t.directionTrSqHint, from: "TR", to: "SQ" },
                { value: "sq-tr", title: t.directionSqTr, hint: t.directionSqTrHint, from: "SQ", to: "TR" },
              ] as { value: Direction; title: string; hint: string; from: string; to: string }[]
            ).map((o) => {
              const selected = prefs.direction === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => !selected && save({ direction: o.value })}
                  className={`pressable flex flex-col items-start rounded-2xl p-3 text-left ring-1 ${
                    selected ? "bg-accent-soft ring-2 ring-accent-text" : "bg-surface-2 ring-transparent hover:ring-hairline"
                  }`}
                >
                  <span className="flex items-center gap-1 text-[12px] font-bold tracking-wide">
                    <span className="rounded-md bg-brand-red px-1.5 py-0.5 text-white">{o.from}</span>
                    <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                    <span className="rounded-md bg-brand-ink px-1.5 py-0.5 text-brand-paper">{o.to}</span>
                  </span>
                  <span className="mt-2 text-[15px] leading-tight font-semibold">{o.title}</span>
                  <span className="text-[12px] text-muted">{o.hint}</span>
                </button>
              );
            })}
          </div>
          {uiForDirection !== lang && (
            <button
              type="button"
              disabled={pending}
              onClick={() => changeLanguage(uiForDirection)}
              className="fade-in pressable mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 text-[14px] font-semibold text-accent-text disabled:opacity-60"
            >
              {t.directionUi.replace("{language}", LANGUAGE_NAME[uiForDirection])}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="p-4">
          <p id="pref-goal" className="text-[17px]">
            {t.goalLabel}
          </p>
          <p className="text-[13px] text-muted">{t.goalHint}</p>
          <div role="radiogroup" aria-labelledby="pref-goal" className="mt-3 grid grid-cols-4 gap-2">
            {DAILY_GOALS.map((g) => {
              const selected = prefs.dailyGoal === g;
              return (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${t.lessonsN.replace("{n}", String(g))} · ${t.goalNames[String(g) as keyof T["goalNames"]]}`}
                  onClick={() => !selected && save({ dailyGoal: g })}
                  className={`pressable flex flex-col items-center rounded-2xl py-2.5 ${
                    selected ? "bg-accent text-on-accent shadow-float" : "bg-surface-2 text-foreground"
                  }`}
                >
                  <span className={`text-[20px] font-bold ${selected ? "pop-in" : ""}`}>{g}</span>
                  <span className={`text-[11px] font-medium ${selected ? "text-on-accent/90" : "text-muted"}`}>
                    {t.goalNames[String(g) as keyof T["goalNames"]]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Group>

      {/* Sound */}
      <Group title={t.soundTitle} i={2}>
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p id="pref-speech" className="text-[17px]">
              {t.speechLabel}
            </p>
            <button
              type="button"
              onClick={() => speakAlbanian("Mirëdita, si jeni?")}
              className="pressable flex h-9 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[14px] font-semibold text-accent-text"
            >
              <Volume2 aria-hidden="true" className="h-4 w-4" />
              {t.speechTest}
            </button>
          </div>
          <Segmented
            labelledBy="pref-speech"
            value={prefs.speechSpeed}
            onChange={(v: SpeechSpeed) => save({ speechSpeed: v })}
            options={[
              { value: "slow", label: t.speechSlow, icon: <span aria-hidden="true">🐢</span> },
              { value: "normal", label: t.speechNormal, icon: <span aria-hidden="true">🙂</span> },
              { value: "fast", label: t.speechFast, icon: <span aria-hidden="true">🐇</span> },
            ]}
          />
          {!voice && <p className="mt-2 text-[13px] text-muted">{t.speechNoVoice}</p>}
        </div>
        <SwitchRow label={t.readingLabel} hint={t.readingHint} checked={prefs.showReading} onChange={(v) => save({ showReading: v })} />
      </Group>

      {/* Appearance */}
      <Group title={t.appearanceTitle} i={3}>
        <div className="p-4">
          <p id="pref-theme" className="text-[17px]">
            {t.themeLabel}
          </p>
          <div role="radiogroup" aria-labelledby="pref-theme" className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                { value: "system", label: t.themeSystem, Icon: Monitor },
                { value: "light", label: t.themeLight, Icon: Sun },
                { value: "dark", label: t.themeDark, Icon: Moon },
              ] as { value: Theme; label: string; Icon: typeof Sun }[]
            ).map(({ value, label, Icon }) => {
              const selected = prefs.theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => !selected && save({ theme: value })}
                  className={`pressable flex flex-col items-center gap-2 rounded-2xl p-2 pb-2.5 ring-1 ${
                    selected ? "ring-2 ring-accent-text" : "ring-hairline hover:ring-foreground/20"
                  }`}
                >
                  <ThemePreview theme={value} />
                  <span className="flex items-center gap-1 text-[13px] font-semibold">
                    <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <SwitchRow label={t.largeTextLabel} hint={t.largeTextHint} checked={prefs.largeText} onChange={(v) => save({ largeText: v })} />
        <SwitchRow label={t.motionLabel} hint={t.motionHint} checked={prefs.reduceMotion} onChange={(v) => save({ reduceMotion: v })} />
      </Group>

      {/* Interface language (saved on the account) */}
      <Group title={languageLabel} i={4}>
        <div className="p-2">
          <div role="radiogroup" aria-label={languageLabel} className="flex rounded-xl bg-surface-2 p-1">
            {(["tr", "sq"] as const).map((code) => (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={code === lang}
                disabled={pending}
                onClick={() => changeLanguage(code)}
                className={`pressable h-10 flex-1 rounded-lg text-[15px] font-semibold ${
                  code === lang ? "bg-surface text-foreground shadow-card" : "text-muted"
                }`}
              >
                {LANGUAGE_NAME[code]}
              </button>
            ))}
          </div>
        </div>
      </Group>

      {/* Help */}
      <Group title={t.helpTitle} i={5}>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_GUIDE_EVENT, { detail: { step: 0 } }))}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 active:bg-surface-2"
        >
          <Compass aria-hidden="true" className="h-5 w-5 shrink-0 text-accent-text" />
          <span className="flex-1">
            <span className="block text-[17px]">{tourLabel}</span>
            <span className="block text-[13px] text-muted">{tourHint}</span>
          </span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted/60" />
        </button>
        <Link href={`/${lang}/faq`} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 active:bg-surface-2">
          <CircleHelp aria-hidden="true" className="h-5 w-5 shrink-0 text-accent-text" />
          <span className="flex-1">
            <span className="block text-[17px]">{t.faq}</span>
            <span className="block text-[13px] text-muted">{t.faqHint}</span>
          </span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted/60" />
        </Link>
        <button
          type="button"
          onClick={() => {
            const keep = { direction: prefs.direction, nickname: prefs.nickname };
            updatePreferences({ ...DEFAULT_PREFERENCES, ...keep });
            setToast(t.resetDone);
          }}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-[17px] text-accent-text transition-colors duration-150 active:bg-surface-2"
        >
          <RotateCcw aria-hidden="true" className="h-5 w-5 shrink-0" />
          {t.reset}
        </button>
      </Group>

      <Toast message={toast} onDone={() => setToast("")} />
    </div>
  );
}

function Group({ title, i, children }: { title: string; i: number; children: ReactNode }) {
  return (
    <section style={{ "--i": i } as CSSProperties} className="fade-in">
      <h2 className="mb-1.5 px-4 text-[13px] font-medium text-muted">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline [&>*+*]:border-t [&>*+*]:border-hairline">
        {children}
      </div>
    </section>
  );
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-4 py-3">
      <span>
        <span className="block text-[17px]">{label}</span>
        <span className="block text-[13px] text-muted">{hint}</span>
      </span>
      <Switch label={label} checked={checked} onChange={onChange} />
    </label>
  );
}

function Segmented<V extends string>({
  labelledBy,
  value,
  onChange,
  options,
}: {
  labelledBy: string;
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: string; icon?: ReactNode }[];
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="mt-3 flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => o.value !== value && onChange(o.value)}
          className={`pressable flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-[15px] font-semibold ${
            o.value === value ? "bg-surface text-foreground shadow-card" : "text-muted"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tiny picture of the app in each theme (system = half light, half dark). */
function ThemePreview({ theme }: { theme: Theme }) {
  const light = { bg: "#FBF9F8", card: "#FFFFFF", line: "#1E1A22" };
  const dark = { bg: "#1E1A22", card: "#29242E", line: "#FBF9F8" };
  const pane = (c: typeof light) => (
    <span className="flex h-full flex-1 flex-col gap-1 p-1.5" style={{ background: c.bg }}>
      <span className="h-1.5 w-2/3 rounded-full" style={{ background: c.line, opacity: 0.7 }} />
      <span className="flex-1 rounded-md" style={{ background: c.card, boxShadow: "0 0 0 1px rgb(127 127 127 / 0.2)" }} />
      <span className="h-1.5 w-1/2 rounded-full bg-brand-red" />
    </span>
  );
  return (
    <span aria-hidden="true" className="flex h-16 w-full overflow-hidden rounded-xl ring-1 ring-hairline">
      {theme === "dark" ? pane(dark) : pane(light)}
      {theme === "system" && pane(dark)}
    </span>
  );
}
