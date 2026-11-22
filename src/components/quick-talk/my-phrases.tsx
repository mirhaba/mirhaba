"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { ChevronRight, Languages, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import type { CustomPhraseRow } from "@/lib/offline-db";
import { MAX_PHRASE_CHARS } from "@/lib/custom-phrases/merge";
import { deleteCustomPhrase, saveCustomPhrase } from "@/lib/custom-phrases/store";
import { Button } from "@/components/ui/button";

type T = Messages["quickTalk"];

/** The person's own phrases: tap to show, pencil to edit. Shown above the categories. */
export function MyPhrases({
  lang,
  t,
  phrases,
  onOpen,
  onChanged,
  onMessage,
}: {
  lang: Locale;
  t: T;
  phrases: CustomPhraseRow[] | null;
  onOpen: (row: CustomPhraseRow) => void;
  onChanged: () => void;
  onMessage: (m: string) => void;
}) {
  const [editing, setEditing] = useState<CustomPhraseRow | "new" | null>(null);

  return (
    <section aria-labelledby="own-heading">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="own-heading" className="text-[20px] font-semibold">
          {t.myPhrases}
        </h2>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="pressable inline-flex h-10 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 text-[15px] font-semibold text-accent-text"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t.addPhrase}
        </button>
      </div>

      {phrases === null ? null : phrases.length ? (
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
          {phrases.map((p, i) => {
            const primary = lang === "tr" ? p.tr || p.sq : p.sq || p.tr;
            const secondary = lang === "tr" ? p.sq : p.tr;
            return (
              <li key={p.id} style={{ "--i": i } as CSSProperties} className="fade-in flex items-stretch border-b border-hairline last:border-b-0">
                <button
                  type="button"
                  onClick={() => onOpen(p)}
                  className="flex min-h-[60px] flex-1 items-center gap-3 py-2.5 pl-4 text-left transition-colors duration-150 active:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] leading-snug font-medium">{primary}</span>
                    {secondary && (
                      <span lang={lang === "tr" ? "sq" : "tr"} className="block text-[15px] leading-snug text-muted">
                        {secondary}
                      </span>
                    )}
                  </span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted/60" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  aria-label={`${t.edit}: ${primary}`}
                  className="pressable flex w-14 shrink-0 items-center justify-center text-muted/70 hover:text-muted"
                >
                  <Pencil aria-hidden="true" className="h-[18px] w-[18px]" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="fade-in pressable flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-hairline p-4 text-left hover:border-accent-text/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
            <UserRound aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span>
            <span className="block font-medium">{t.myPhrasesEmptyTitle}</span>
            <span className="block text-[13px] text-muted">{t.myPhrasesEmpty}</span>
          </span>
        </button>
      )}

      {editing && (
        <PhraseEditor
          lang={lang}
          t={t}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            onChanged();
            onMessage(message);
          }}
        />
      )}
    </section>
  );
}

function PhraseEditor({
  lang,
  t,
  initial,
  onClose,
  onSaved,
}: {
  lang: Locale;
  t: T;
  initial: CustomPhraseRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tr, setTr] = useState(initial?.tr ?? "");
  const [sq, setSq] = useState(initial?.sq ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [translating, startTranslate] = useTransition();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Fill the empty side from the filled one with the app's translator (needs an account; counts toward the daily quota).
  const autoTranslate = () => {
    const fromTr = !!tr.trim() && !sq.trim() ? true : !!sq.trim() && !tr.trim() ? false : lang === "tr";
    const text = (fromTr ? tr : sq).trim();
    if (!text) return setNote(t.translateHint);
    setNote(null);
    startTranslate(async () => {
      try {
        const { translateText } = await import("@/app/[lang]/translate/actions");
        const result = await translateText({ lang, text, direction: fromTr ? "tr-sq" : "sq-tr", variant: "kosovan" });
        if (result.ok) (fromTr ? setSq : setTr)(result.translation);
        else setNote(result.error === "auth" || result.error === "consent" ? t.translateNeedsSignIn : result.error === "limit" ? t.translateLimit : t.translateFailed);
      } catch {
        setNote(t.translateFailed);
      }
    });
  };

  const save = async () => {
    if (!tr.trim() || !sq.trim()) return setNote(t.needBoth);
    setSaving(true);
    const ok = await saveCustomPhrase({ id: initial?.id, tr, sq });
    setSaving(false);
    if (!ok) return setNote(t.phrasesFull);
    onSaved(t.phraseSaved);
    ref.current?.close();
  };

  const field = (id: string, label: string, code: "tr" | "sq", value: string, set: (v: string) => void, placeholder: string) => (
    <div key={id}>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-muted">
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${code === "tr" ? "bg-brand-red text-white" : "bg-brand-ink text-brand-paper"}`}>
          {code.toUpperCase()}
        </span>
        {label}
      </label>
      <textarea
        id={id}
        lang={code}
        value={value}
        rows={2}
        maxLength={MAX_PHRASE_CHARS}
        placeholder={placeholder}
        onChange={(e) => set(e.target.value)}
        className="w-full resize-none rounded-2xl bg-surface px-4 py-3 text-[17px] shadow-card ring-1 ring-hairline outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent-text"
      />
    </div>
  );

  // The person's own language first.
  const fields = [
    field("own-tr", t.fieldTr, "tr", tr, setTr, t.fieldTrPlaceholder),
    field("own-sq", t.fieldSq, "sq", sq, setSq, t.fieldSqPlaceholder),
  ];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="own-editor-title"
      className="sheet m-auto mb-0 w-full max-w-md rounded-t-[28px] bg-background p-5 text-foreground shadow-float sm:mb-auto sm:rounded-[28px]"
    >
      <h2 id="own-editor-title" className="text-[22px] font-bold">
        {initial ? t.editPhrase : t.newPhrase}
      </h2>
      <p className="mt-1 text-[14px] text-muted">{t.translateHint}</p>
      <div className="mt-4 flex flex-col gap-3">{lang === "tr" ? fields : [...fields].reverse()}</div>
      <button
        type="button"
        onClick={autoTranslate}
        disabled={translating}
        aria-busy={translating || undefined}
        className="pressable mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 text-[15px] font-semibold text-accent-text disabled:opacity-60"
      >
        <Languages aria-hidden="true" className={`h-4 w-4 ${translating ? "animate-pulse" : ""}`} />
        {t.translateFill}
      </button>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-accent-text">
        {note}
      </p>
      <div className="mt-3 flex gap-2">
        {initial && (
          <Button
            variant="plain"
            aria-label={t.delete}
            className="w-12 shrink-0 px-0 text-accent-text"
            onClick={async () => {
              await deleteCustomPhrase(initial.id);
              onSaved(t.phraseDeleted);
              ref.current?.close();
            }}
          >
            <Trash2 aria-hidden="true" className="h-5 w-5" />
          </Button>
        )}
        <Button variant="secondary" className="flex-1" onClick={() => ref.current?.close()}>
          {t.cancel}
        </Button>
        <Button className="flex-1" loading={saving} onClick={save}>
          {t.save}
        </Button>
      </div>
    </dialog>
  );
}
