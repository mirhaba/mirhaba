"use client";

// Plays a phrase. Recorded native audio wins; device text-to-speech is the fallback.
// Most phones have no Albanian TTS voice, so callers must handle `false` (show the text instead).

import { readPreferences, SPEECH_RATE } from "@/lib/preferences";

let current: HTMLAudioElement | null = null;

/** Voice speed chosen in Preferences (slow / normal / fast). */
const rate = () => SPEECH_RATE[readPreferences().speechSpeed];

function albanianVoice(): SpeechSynthesisVoice | undefined {
  if (typeof speechSynthesis === "undefined") return undefined;
  return speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("sq"));
}

export function canSpeakAlbanian(): boolean {
  return !!albanianVoice();
}

export function canSpeakTurkish(): boolean {
  if (typeof speechSynthesis === "undefined") return false;
  return speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith("tr"));
}

export function stopSpeaking() {
  current?.pause();
  current = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

/** Reads a reply aloud in Turkish so the user hears the answer. Silent if no Turkish voice. */
export function speakTurkish(text: string) {
  if (typeof speechSynthesis === "undefined") return;
  stopSpeaking();
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("tr"));
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? "tr-TR";
  if (voice) utterance.voice = voice;
  utterance.rate = rate() + 0.1;
  speechSynthesis.speak(utterance);
}

/** Returns false when nothing can be played on this device. */
export function speakAlbanian(text: string, audioSrc?: string, onEnd?: () => void): boolean {
  stopSpeaking();

  if (audioSrc) {
    const audio = new Audio(audioSrc);
    audio.playbackRate = Math.max(0.75, Math.min(1.15, rate() / 0.9));
    current = audio;
    audio.onended = () => onEnd?.();
    audio.play().catch(() => onEnd?.());
    return true;
  }

  const voice = albanianVoice();
  if (!voice) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = rate();
  utterance.onend = () => onEnd?.();
  speechSynthesis.speak(utterance);
  return true;
}
