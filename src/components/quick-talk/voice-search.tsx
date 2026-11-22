"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import type { Locale } from "@/i18n/config";

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib everywhere).
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Microphone button for the phrase search: say "doctor" or "kira" instead of typing. Uses the
 * browser's own speech recognition (hidden where there is none). Listens in the interface language.
 */
export function VoiceSearchButton({
  lang,
  labels,
  onResult,
  onMessage,
}: {
  lang: Locale;
  labels: { voiceSearch: string; listening: string; voiceError: string; voiceDenied: string };
  onResult: (text: string) => void;
  onMessage: (text: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSupported(!!recognitionCtor()), 0);
    return () => {
      clearTimeout(timer);
      rec.current?.abort();
    };
  }, []);

  if (!supported) return null;

  const start = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) {
      rec.current?.abort();
      return;
    }
    const r = new Ctor();
    r.lang = lang === "sq" ? "sq-AL" : "tr-TR";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) onResult(text);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") onMessage(labels.voiceDenied);
      else if (e.error !== "aborted") onMessage(labels.voiceError);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
      onMessage(labels.listening);
    } catch {
      onMessage(labels.voiceError);
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      aria-label={labels.voiceSearch}
      aria-pressed={listening}
      className={`pressable relative flex h-10 w-10 items-center justify-center rounded-full ${
        listening ? "bg-accent text-on-accent" : "text-muted hover:text-foreground"
      }`}
    >
      {listening && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-accent/40 motion-reduce:animate-none" />}
      <Mic aria-hidden="true" className="relative h-[18px] w-[18px]" />
    </button>
  );
}
