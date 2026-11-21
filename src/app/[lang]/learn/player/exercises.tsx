"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import type { Messages } from "@/i18n/dictionaries";
import type { Item } from "@/lib/content/model";
import { albanianReading } from "@/lib/text";
import { canSpeakAlbanian, speakAlbanian } from "@/components/quick-talk/speak";

type T = Messages["learn"]["player"];

/** Play button, shown only when the device has an Albanian voice (recorded audio comes later). */
function Listen({ text, label }: { text: string; label: string }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const check = () => setAvailable(canSpeakAlbanian());
    const timer = setTimeout(check, 0);
    window.speechSynthesis?.addEventListener?.("voiceschanged", check);
    return () => {
      clearTimeout(timer);
      window.speechSynthesis?.removeEventListener?.("voiceschanged", check);
    };
  }, []);
  if (!available) return null;
  return (
    <button
      type="button"
      onClick={() => speakAlbanian(text)}
      aria-label={label}
      className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text"
    >
      <Volume2 aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}

export function PromptAlbanian({ text, t }: { text: string; t: T }) {
  return (
    <div className="flex items-center gap-3">
      <p lang="sq" className="text-[28px] leading-tight font-bold break-words">
        {text}
      </p>
      <Listen text={text} label={t.listen} />
    </div>
  );
}

// ---------------------------------------------------------------- Learn card

export function LearnCard({ item, lang, t }: { item: Item; lang: "tr" | "sq"; t: T }) {
  return (
    <div className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-hairline">
      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-text">{t.newWord}</span>
      <div className="mt-4">
        <PromptAlbanian text={item.sq} t={t} />
      </div>
      <p className="mt-1 text-[17px] text-muted">
        <span className="sr-only">{t.reading}: </span>
        {albanianReading(item.sq)}
      </p>
      <p lang="tr" className="mt-4 border-t border-hairline pt-4 text-[22px] font-semibold">
        {item.tr}
      </p>
      {item.note && <p className="mt-2 text-[15px] text-muted">{item.note[lang]}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Choose (cards, not radio dots)

export function Choose({
  options,
  optionLang,
  value,
  onChange,
  locked,
  correctOption,
  label,
}: {
  options: string[];
  optionLang: "tr" | "sq";
  value: string | null;
  onChange: (v: string) => void;
  locked: boolean;
  correctOption: string;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2">
      {options.map((option, i) => {
        const selected = value === option;
        const showCorrect = locked && option === correctOption;
        const showWrong = locked && selected && option !== correctOption;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={locked}
            onClick={() => onChange(option)}
            style={{ "--i": i } as React.CSSProperties}
            className={`fade-in pressable flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-[17px] font-medium disabled:cursor-default ${
              showCorrect
                ? "bg-accent-soft ring-2 ring-accent-text"
                : showWrong
                  ? "bg-surface-2 line-through opacity-70 ring-1 ring-hairline"
                  : selected
                    ? "bg-surface ring-2 ring-foreground"
                    : "bg-surface shadow-card ring-1 ring-hairline hover:bg-surface-2"
            }`}
          >
            <span lang={optionLang}>{option}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- Match pairs

export function Match({ items, t, onDone }: { items: Item[]; t: T; onDone: (wrongIds: string[]) => void }) {
  // Right column in a different, stable order (rotation keeps server and client identical).
  const right = useMemo(() => [...items.slice(1), items[0]], [items]);
  const [picked, setPicked] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [miss, setMiss] = useState<string | null>(null);
  const wrongIds = useRef(new Set<string>());

  const tapRight = (id: string) => {
    if (!picked) return;
    if (picked === id) {
      const next = [...matched, id];
      setMatched(next);
      setPicked(null);
      if (next.length === items.length) onDone([...wrongIds.current]);
    } else {
      wrongIds.current.add(picked);
      setMiss(id);
      setTimeout(() => setMiss(null), 300);
    }
  };

  const tile = (active: boolean, done: boolean, wrong: boolean) =>
    `pressable min-h-14 rounded-2xl px-3 py-2 text-[17px] font-medium transition-opacity duration-200 ${
      done
        ? "bg-surface-2 text-muted opacity-50"
        : wrong
          ? "bg-accent-soft ring-2 ring-accent-text"
          : active
            ? "bg-surface ring-2 ring-foreground"
            : "bg-surface shadow-card ring-1 ring-hairline"
    }`;

  return (
    <div>
      <p className="mb-3 text-[15px] text-muted">{t.matchHint}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              lang="sq"
              disabled={matched.includes(item.id)}
              aria-pressed={picked === item.id}
              onClick={() => setPicked(item.id)}
              className={tile(picked === item.id, matched.includes(item.id), false)}
            >
              {item.sq}
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          {right.map((item) => (
            <button
              key={item.id}
              type="button"
              lang="tr"
              disabled={matched.includes(item.id) || !picked}
              onClick={() => tapRight(item.id)}
              className={tile(false, matched.includes(item.id), miss === item.id)}
            >
              {item.tr}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Order words

export function Order({
  tiles,
  chosen,
  onChange,
  locked,
  t,
}: {
  tiles: string[];
  /** Indexes into `tiles`, in the order picked. */
  chosen: number[];
  onChange: (next: number[]) => void;
  locked: boolean;
  t: T;
}) {
  return (
    <div>
      <p className="mb-2 text-[15px] text-muted">{t.orderHint}</p>
      <div
        aria-label={t.answer}
        role="group"
        className="flex min-h-16 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-hairline p-2"
      >
        {chosen.map((tileIndex, pos) => (
          <button
            key={`${tileIndex}-${pos}`}
            type="button"
            lang="sq"
            disabled={locked}
            onClick={() => onChange(chosen.filter((_, i) => i !== pos))}
            className="fade-in pressable h-11 rounded-xl bg-surface px-3 text-[17px] font-medium shadow-card ring-1 ring-hairline"
          >
            {tiles[tileIndex]}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tiles.map((word, i) =>
          chosen.includes(i) ? (
            <span key={i} aria-hidden="true" className="h-11 rounded-xl bg-surface-2 px-3 text-[17px] text-transparent">
              {word}
            </span>
          ) : (
            <button
              key={i}
              type="button"
              lang="sq"
              disabled={locked}
              onClick={() => onChange([...chosen, i])}
              className="pressable h-11 rounded-xl bg-surface px-3 text-[17px] font-medium shadow-card ring-1 ring-hairline hover:bg-surface-2"
            >
              {word}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Type the Albanian

export function TypeAnswer({
  value,
  onChange,
  onSubmit,
  locked,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  locked: boolean;
  t: T;
}) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!locked) input.current?.focus();
  }, [locked]);

  // Turkish keyboards have no ë; ç exists but we add both for convenience.
  const insert = (c: string) => {
    const el = input.current;
    if (!el) return onChange(value + c);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + c + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + c.length, start + c.length);
    });
  };

  return (
    <div>
      <label htmlFor="type-answer" className="mb-1.5 block text-[13px] font-medium text-muted">
        {t.typeLabel}
      </label>
      <input
        ref={input}
        id="type-answer"
        lang="sq"
        value={value}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit();
        }}
        placeholder={t.typePlaceholder}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="done"
        className="h-14 w-full rounded-2xl bg-surface px-4 text-[20px] shadow-card ring-1 ring-hairline outline-none focus:ring-2 focus:ring-accent-text/40 disabled:opacity-70"
      />
      <div className="mt-2 flex gap-2">
        {["ë", "ç"].map((c) => (
          <button
            key={c}
            type="button"
            disabled={locked}
            onClick={() => insert(c)}
            aria-label={t.insertLetter.replace("{c}", c)}
            className="pressable h-11 w-11 rounded-xl bg-surface-2 text-[20px] font-semibold"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
