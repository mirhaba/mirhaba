"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import type { Messages } from "@/i18n/dictionaries";
import { Switch } from "@/components/ui/switch";
import { getReminder, removeReminder, saveReminder } from "@/lib/reminders/actions";

type T = Messages["prefs"];

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
/** 06:00 … 23:30 in half hours. */
const TIMES = Array.from({ length: 36 }, (_, i) => 360 + i * 30);
const DEFAULT_TIME = 19 * 60;

type Support = "checking" | "ok" | "ios" | "unsupported" | "unconfigured";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

async function registration(): Promise<ServiceWorkerRegistration> {
  // In production the app already registered /sw.js; otherwise register it now (it handles the push).
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

/**
 * Daily reminder on this device (web push). Sent only on days without a lesson, at the chosen
 * local time. iPhones need the app on the Home Screen first; the hint says how.
 */
export function ReminderSettings({ t, onMessage }: { t: T; onMessage: (message: string) => void }) {
  const [support, setSupport] = useState<Support>("checking");
  const [on, setOn] = useState(false);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const hasPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      if (!hasPush) return setSupport(ios ? "ios" : "unsupported");
      if (!PUBLIC_KEY) return setSupport("unconfigured");
      setSupport("ok");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (!sub || Notification.permission !== "granted") return;
      const saved = await getReminder(sub.endpoint).catch(() => null);
      if (alive && saved) {
        setOn(true);
        setTime(saved.remindAt);
      }
    };
    void check().catch(() => alive && setSupport("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  const save = async (remindAt: number, showPreview: boolean) => {
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      onMessage(t.remindersDenied);
      return false;
    }
    const reg = await registration();
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
    const result = await saveReminder({
      subscription: sub.toJSON(),
      remindAt,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Belgrade",
    });
    if (!result.ok) {
      onMessage(t.remindersError);
      return false;
    }
    if (showPreview) {
      // A sample right away, so people see what they signed up for (and that it works).
      await reg.showNotification("Mirhaba", { body: t.remindersTest, icon: "/icons/icon-192.png", tag: "reminder-preview" }).catch(() => {});
      onMessage(t.remindersOn);
    }
    return true;
  };

  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        if (await save(time, true)) setOn(true);
      } else {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await removeReminder(sub.endpoint);
          await sub.unsubscribe().catch(() => {});
        }
        setOn(false);
        onMessage(t.remindersOff);
      }
    } catch {
      onMessage(t.remindersError);
    } finally {
      setBusy(false);
    }
  };

  const hint =
    support === "ios"
      ? t.remindersIos
      : support === "unsupported"
        ? t.remindersUnsupported
        : support === "unconfigured"
          ? t.remindersNotConfigured
          : t.remindersHint;

  return (
    <>
      <label className={`flex min-h-14 items-center justify-between gap-4 px-4 py-3 ${support === "ok" ? "cursor-pointer" : ""}`}>
        <span className="flex items-start gap-3">
          <BellRing aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${on ? "wiggle text-accent-text" : "text-muted"}`} />
          <span>
            <span className="block text-[17px]">{t.remindersLabel}</span>
            <span className="block text-[13px] text-muted">{hint}</span>
          </span>
        </span>
        <Switch label={t.remindersLabel} checked={on} disabled={support !== "ok" || busy} onChange={(v) => void toggle(v)} />
      </label>
      {on && (
        <label className="fade-in flex min-h-14 items-center justify-between gap-4 px-4 py-3">
          <span className="text-[17px]">{t.remindersTime}</span>
          <select
            value={time}
            disabled={busy}
            onChange={async (e) => {
              const next = Number(e.target.value);
              setTime(next);
              setBusy(true);
              try {
                if (await save(next, false)) onMessage(t.saved);
              } finally {
                setBusy(false);
              }
            }}
            className="h-10 rounded-xl bg-surface-2 px-3 text-[17px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-accent-text"
          >
            {TIMES.map((m) => (
              <option key={m} value={m}>
                {hhmm(m)}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}
