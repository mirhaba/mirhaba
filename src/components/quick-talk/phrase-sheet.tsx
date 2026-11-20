"use client";

import { useEffect, useRef, useState } from "react";
import { Square, Volume2, VolumeX } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { replies, fillSlot, type Phrase, type Reply } from "@/content/quick-talk";
import { albanianReading } from "@/lib/text";
import { canSpeakAlbanian, speakAlbanian, speakTurkish, stopSpeaking } from "./speak";

type T = Messages["quickTalk"];

/**
 * "Show this to the other person": the Albanian is the one big thing on screen,
 * Play is the one primary action, the reply board is for the Kosovan to tap.
 */
export function PhraseSheet({
  phrase,
  lang,
  t,
  closeLabel,
  onClose,
}: {
  phrase: Phrase;
  lang: Locale;
  t: T;
  closeLabel: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [slotIndex, setSlotIndex] = useState(0);
  const [answer, setAnswer] = useState<Reply | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [hasVoice, setHasVoice] = useState(true);

  const option = phrase.slot?.[slotIndex];
  const sq = fillSlot(phrase.sq, option?.sq);
  const tr = fillSlot(phrase.tr, option?.tr);
  const replyButtons = (phrase.replies ?? []).map((id) => replies[id]).filter(Boolean);

  const play = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const ok = speakAlbanian(sq, phrase.audio, () => setSpeaking(false));
    setSpeaking(ok);
    setHasVoice(ok);
  };

  useEffect(() => {
    dialogRef.current?.showModal();
    // Voices load asynchronously on some browsers.
    const check = () => setHasVoice(!!phrase.audio || canSpeakAlbanian());
    const synth = typeof speechSynthesis === "undefined" ? null : speechSynthesis;
    const timer = setTimeout(check, 0);
    synth?.addEventListener?.("voiceschanged", check);
    return () => {
      clearTimeout(timer);
      stopSpeaking();
      synth?.removeEventListener?.("voiceschanged", check);
    };
  }, [phrase.audio]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="phrase-sq"
      className="sheet m-0 mt-auto h-[100dvh] max-h-none w-full max-w-none bg-background p-0 text-foreground sm:m-auto sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-3xl sm:shadow-float"
    >
      <div className="flex min-h-full flex-col gap-5 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex h-11 items-center justify-between">
          <p className="text-[15px] font-medium text-muted">{t.showTitle}</p>
          <form method="dialog">
            <button type="submit" className="pressable -mr-3 h-11 rounded-full px-3 text-[17px] font-semibold text-accent-text">
              {closeLabel}
            </button>
          </form>
        </div>

        <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-hairline">
          <p id="phrase-sq" lang="sq" className="text-[40px] leading-[1.1] font-bold break-words">
            {sq}
          </p>
          {lang === "tr" && (
            <p className="mt-2 text-[17px] text-muted">
              <span className="sr-only">{t.reading}: </span>
              {albanianReading(sq)}
            </p>
          )}
          <p lang="tr" className="mt-5 border-t border-hairline pt-4 text-[20px]">
            {tr}
          </p>
        </div>

        {phrase.slot && (
          <div role="radiogroup" aria-label={t.chooseOption} className="flex rounded-xl bg-surface-2 p-1">
            {phrase.slot.map((o, i) => (
              <button
                key={o.sq}
                type="button"
                role="radio"
                aria-checked={i === slotIndex}
                onClick={() => setSlotIndex(i)}
                className={`pressable h-11 flex-1 rounded-lg px-3 text-[17px] font-semibold ${
                  i === slotIndex ? "bg-surface text-foreground shadow-card" : "text-muted"
                }`}
              >
                {lang === "tr" ? o.tr : o.sq}
              </button>
            ))}
          </div>
        )}

        {hasVoice ? (
          <button
            type="button"
            onClick={play}
            className="pressable flex h-14 items-center justify-center gap-2.5 rounded-2xl bg-accent text-[17px] font-semibold text-on-accent hover:bg-accent-pressed"
          >
            {speaking ? (
              <Square aria-hidden="true" className="h-5 w-5" fill="currentColor" />
            ) : (
              <Volume2 aria-hidden="true" className="h-5 w-5" />
            )}
            {speaking ? t.stop : t.play}
          </button>
        ) : (
          <p className="flex items-center gap-2.5 rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-muted">
            <VolumeX aria-hidden="true" className="h-5 w-5 shrink-0" />
            {t.noVoice}
          </p>
        )}

        {replyButtons.length > 0 && (
          <section aria-labelledby="reply-heading" className="mt-auto pt-2">
            <h2 id="reply-heading" lang="sq" className="text-[20px] font-semibold">
              {t.replyHintSq}
            </h2>
            <p className="mb-3 text-[15px] text-muted">{t.replyHint}</p>
            <div className="grid grid-cols-2 gap-2">
              {replyButtons.map((r, i) => {
                const selected = answer?.id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setAnswer(r);
                      setSpeaking(false);
                      speakTurkish(r.tr);
                    }}
                    style={{ "--i": i } as React.CSSProperties}
                    className={`fade-in pressable min-h-14 rounded-2xl px-3 py-2 text-[20px] font-semibold ${
                      selected
                        ? "bg-accent-soft text-accent-text ring-2 ring-accent-text"
                        : "bg-surface shadow-card ring-1 ring-hairline hover:bg-surface-2"
                    }`}
                  >
                    <span lang="sq">{r.sq}</span>
                  </button>
                );
              })}
            </div>
            <div role="status" aria-live="assertive" className="mt-3 min-h-[60px]">
              {answer && (
                <p key={answer.id} className="fade-in rounded-2xl bg-accent-soft px-4 py-3 text-center">
                  <span className="block text-[13px] font-medium text-accent-text">{t.theyAnswered}</span>
                  <span lang="tr" className="block text-[24px] font-bold">
                    {answer.tr}
                  </span>
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </dialog>
  );
}
