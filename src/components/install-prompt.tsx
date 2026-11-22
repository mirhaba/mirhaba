"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share } from "lucide-react";
import type { Messages } from "@/i18n/dictionaries";
import { readConsentCookie } from "@/lib/consent";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

const VISITS_KEY = "mirhaba:visits";
const DISMISSED_KEY = "mirhaba:install-dismissed";

function readNumber(key: string): number {
  try {
    return Number(localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the hint just shows again next time */
  }
}

/**
 * Screens where the hint would sit on top of what the person is doing (lesson answers, the code
 * field, the text box): it waits for a calmer screen instead.
 */
const FOCUSED = /^\/(tr|sq)\/(learn\/.+|login|app|translate|checkout)(\/|$)/;

/** Friendly "Add to Home Screen" hint from the second visit on (Android prompt or iPhone steps). */
export function InstallPrompt({ t }: { t: Messages["install"] }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");
  const focused = FOCUSED.test(usePathname() ?? "");

  useEffect(() => {
    const visits = readNumber(VISITS_KEY) + 1;
    write(VISITS_KEY, String(visits));

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    // Never stack on top of the cookie banner: wait until a cookie choice exists.
    if (standalone || visits < 2 || readNumber(DISMISSED_KEY) || !readConsentCookie()) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      // iOS has no install event; show the manual steps once the page has settled.
      const timer = setTimeout(() => setMode("ios"), 1500);
      return () => clearTimeout(timer);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (mode === "hidden" || focused) return null;

  const dismiss = () => {
    write(DISMISSED_KEY, "1");
    setMode("hidden");
  };

  return (
    <aside
      aria-labelledby="install-title"
      className="fade-in fixed inset-x-3 bottom-20 z-40 rounded-2xl bg-glass-strong p-4 shadow-float ring-1 ring-hairline backdrop-blur-xl backdrop-saturate-150 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm"
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
          {mode === "ios" ? <Share aria-hidden="true" className="h-5 w-5" /> : <Download aria-hidden="true" className="h-5 w-5" />}
        </div>
        <div>
          <h2 id="install-title" className="font-semibold">
            {t.title}
          </h2>
          <p className="mt-0.5 text-[15px] text-muted">{mode === "ios" ? t.iosBody : t.body}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={dismiss} className="pressable h-11 rounded-full px-4 font-semibold text-muted hover:text-foreground">
          {t.dismiss}
        </button>
        {mode === "android" && deferred && (
          <button
            type="button"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice;
              dismiss();
            }}
            className="pressable h-11 rounded-full bg-accent px-5 font-semibold text-on-accent hover:bg-accent-pressed"
          >
            {t.action}
          </button>
        )}
      </div>
    </aside>
  );
}
