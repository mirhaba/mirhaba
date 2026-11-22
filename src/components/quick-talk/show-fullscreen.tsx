"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";

type WakeLock = { release: () => Promise<void> };

/**
 * The phrase as big as the screen allows, to hold up to someone across a counter or through a
 * car window. Asks the browser for full screen and keeps the display awake (where supported).
 * Tap anywhere or press Esc to close.
 */
export function ShowFullScreen({
  text,
  sub,
  lang,
  subLang,
  hint,
  rotateHint,
  onClose,
}: {
  text: string;
  sub?: string;
  lang: string;
  subLang: string;
  hint: string;
  rotateHint: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [size, setSize] = useState({ w: 390, h: 844 });

  useEffect(() => {
    const measure = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // As big as fits: area per character (DM Sans bold ≈ 0.55em wide, 1.05 line height) over ~65% of
  // the screen, capped so one short word doesn't become absurd.
  // Also small enough that the longest word fits on one line (never "Përshën-detje").
  const longestWord = Math.max(4, ...text.split(/\s+/).map((w) => w.length));
  const fontSize = Math.round(
    Math.max(
      28,
      Math.min(
        Math.sqrt((0.65 * size.w * size.h) / (0.58 * Math.max(4, text.length))),
        (0.88 * (size.w - 48)) / (0.62 * longestWord),
        0.3 * size.h,
        0.2 * size.w,
      ),
    ),
  );

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    let lock: WakeLock | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLock> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l), () => {});
    dialog.requestFullscreen?.().catch(() => {});
    return () => {
      void lock?.release().catch(() => {});
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={() => ref.current?.close()}
      aria-label={text}
      className="m-0 h-[100dvh] max-h-none w-screen max-w-none cursor-pointer bg-background p-0 text-foreground backdrop:bg-background"
    >
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <p
          lang={lang}
          className="max-w-full font-bold break-words"
          style={{ fontSize, lineHeight: 1.05 }}
        >
          {text}
        </p>
        {sub && (
          <p lang={subLang} className="text-[clamp(1.25rem,4vw,2.25rem)] text-muted">
            {sub}
          </p>
        )}
        <p className="mt-4 flex items-center gap-2 text-[14px] text-muted portrait:flex landscape:hidden">
          <RotateCw aria-hidden="true" className="h-4 w-4" />
          {rotateHint}
        </p>
        <p className="text-[13px] text-muted/80">{hint}</p>
      </div>
    </dialog>
  );
}
