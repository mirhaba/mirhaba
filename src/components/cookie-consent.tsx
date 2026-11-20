"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cookie } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import {
  CONSENT_COOKIE,
  CONSENT_EVENT,
  CONSENT_MAX_AGE,
  OPEN_SETTINGS_EVENT,
  readConsentCookie,
  serializeConsent,
  type ConsentChoice,
} from "@/lib/consent";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type T = Messages["cookies"];

/** Saves the choice on the server (proof in `consents`) and tells the analytics loader. */
async function saveChoice(choice: ConsentChoice) {
  try {
    const res = await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(choice),
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    // Offline or server down: still respect the choice locally.
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(serializeConsent(choice))}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax`;
  }
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_EVENT, { detail: choice }));
}

/**
 * GDPR cookie banner. Accept, Reject and Settings are equally easy (same size, same style,
 * one tap each). Nothing non-essential loads until the visitor accepts.
 */
export function CookieConsent({ lang, t }: { lang: Locale; t: T }) {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [current, setCurrent] = useState<ConsentChoice | null>(null);

  useEffect(() => {
    const existing = readConsentCookie();
    // Read after hydration so server and client HTML match.
    const timer = setTimeout(() => {
      setCurrent(existing);
      setShowBanner(!existing);
    }, 0);
    const open = () => {
      setCurrent(readConsentCookie());
      setShowSettings(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(OPEN_SETTINGS_EVENT, open);
    };
  }, []);

  const decide = useCallback((choice: ConsentChoice) => {
    setShowBanner(false);
    setShowSettings(false);
    setCurrent(choice);
    void saveChoice(choice);
  }, []);

  return (
    <>
      {showBanner && !showSettings && (
        <section
          aria-labelledby="cookie-title"
          aria-describedby="cookie-body"
          className="fade-in fixed inset-x-3 bottom-20 z-40 rounded-2xl bg-glass-strong p-4 shadow-float ring-1 ring-hairline backdrop-blur-xl backdrop-saturate-150 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md"
        >
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <Cookie aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2 id="cookie-title" className="font-semibold">
                {t.title}
              </h2>
              <p id="cookie-body" className="mt-0.5 text-[13px] leading-snug text-muted">
                {t.body}{" "}
                <Link href={`/${lang}/legal/cookies`} className="font-medium text-accent-text underline-offset-2 hover:underline">
                  {t.policy}
                </Link>
              </p>
            </div>
          </div>
          {/* Equal weight on purpose: rejecting must be exactly as easy as accepting. */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button variant="secondary" className="h-11 px-2 text-[15px] whitespace-nowrap" onClick={() => decide({ analytics: false })}>
              {t.reject}
            </Button>
            <Button variant="secondary" className="h-11 px-2 text-[15px] whitespace-nowrap" onClick={() => setShowSettings(true)}>
              {t.settings}
            </Button>
            <Button variant="secondary" className="h-11 px-2 text-[15px] whitespace-nowrap" onClick={() => decide({ analytics: true })}>
              {t.accept}
            </Button>
          </div>
        </section>
      )}

      {showSettings && (
        <CookieSettings
          t={t}
          initial={current ?? { analytics: false }}
          onSave={decide}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}

function CookieSettings({
  t,
  initial,
  onSave,
  onClose,
}: {
  t: T;
  initial: ConsentChoice;
  onSave: (choice: ConsentChoice) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [analytics, setAnalytics] = useState(initial.analytics);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="cookie-settings-title"
      className="sheet m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-background p-5 text-foreground shadow-float"
    >
      <h2 id="cookie-settings-title" className="text-[22px] font-semibold">
        {t.settingsTitle}
      </h2>
      <p className="mt-1 text-[15px] text-muted">{t.settingsBody}</p>

      <div className="mt-4 overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
        <div className="flex items-center gap-4 px-4 py-3.5">
          <div className="flex-1">
            <p className="text-[17px]">{t.necessary}</p>
            <p className="text-[13px] text-muted">{t.necessaryHint}</p>
          </div>
          <span className="text-[13px] text-muted">{t.alwaysOn}</span>
        </div>
        <label className="flex cursor-pointer items-center gap-4 border-t border-hairline px-4 py-3.5">
          <div className="flex-1">
            <p className="text-[17px]">{t.analytics}</p>
            <p className="text-[13px] text-muted">{t.analyticsHint}</p>
          </div>
          <Switch label={t.analytics} checked={analytics} onChange={setAnalytics} />
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <Button onClick={() => onSave({ analytics })}>{t.save}</Button>
        <Button variant="plain" className="text-muted hover:bg-surface-2" onClick={() => ref.current?.close()}>
          {t.cancel}
        </Button>
      </div>
    </dialog>
  );
}

/** Footer link that reopens the settings at any time (withdrawing consent must be as easy as giving it). */
export function CookieSettingsLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}
      className="inline-flex min-h-11 items-center px-2 hover:text-foreground"
    >
      {label}
    </button>
  );
}
