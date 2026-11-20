"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ChevronRight, Search, SearchX, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import type { Kind, SlangEntry } from "@/content/slang";
import { dictionaryPath } from "@/lib/site";
import { normalizeForSearch } from "@/lib/text";
import { StateView } from "@/components/state-view";

type T = Messages["dictionary"];
const KINDS: (Kind | "all")[] = ["all", "kosovan", "loanword", "turkish_slang"];

/** What to show next to the headword: the other language's equivalent. */
export function equivalentOf(entry: SlangEntry): string {
  return entry.term.lang === "sq" ? entry.tr : (entry.sqKosovo ?? entry.sqStandard);
}

export function DictionaryList({ lang, t, entries }: { lang: Locale; t: T; entries: SlangEntry[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | "all">("all");
  const searchRef = useRef<HTMLInputElement>(null);

  const index = useMemo(
    () =>
      entries.map((entry) => ({
        entry,
        haystack: normalizeForSearch([entry.term.text, entry.tr, entry.sqStandard, entry.sqKosovo ?? ""].join(" ")),
      })),
    [entries],
  );

  const q = normalizeForSearch(query);
  const visible = index
    .filter(({ entry, haystack }) => (kind === "all" || entry.kind === kind) && (!q || haystack.includes(q)))
    .map(({ entry }) => entry);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <label htmlFor="dict-search" className="mb-1.5 block text-[13px] font-medium text-muted">
          {t.searchLabel}
        </label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            id="dict-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            enterKeyHint="search"
            className="h-12 w-full rounded-xl bg-surface-2 pr-11 pl-10 text-[17px] outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent-text/40 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label={t.clearSearch}
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              className="pressable absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted"
            >
              <X aria-hidden="true" className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-1">
        <div role="group" aria-label={t.filters} className="flex w-max gap-2">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`pressable h-10 rounded-full px-4 text-[15px] font-medium whitespace-nowrap ${
                kind === k ? "bg-accent text-on-accent" : "bg-surface text-foreground shadow-card ring-1 ring-hairline hover:bg-surface-2"
              }`}
            >
              {k === "all" ? t.all : t[k]}
            </button>
          ))}
        </div>
      </div>

      {kind !== "all" && <p className="fade-in -mt-1 text-[15px] text-muted">{t.kindHint[kind]}</p>}

      <p className="text-[13px] text-muted" aria-live="polite">
        {t.count.replace("{n}", String(visible.length))}
      </p>

      {visible.length ? (
        <ul key={`${kind}-${q}`} className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
          {visible.map((entry, i) => (
            <li
              key={entry.slug}
              style={{ "--i": i } as React.CSSProperties}
              className="fade-in border-b border-hairline last:border-b-0"
            >
              <Link
                href={dictionaryPath(lang, entry.slug)}
                className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 transition-colors duration-150 active:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span lang={entry.term.lang} className="block text-[17px] leading-snug font-semibold">
                    {entry.term.text}
                  </span>
                  <span lang={entry.term.lang === "sq" ? "tr" : "sq"} className="block truncate text-[15px] leading-snug text-muted">
                    {equivalentOf(entry)}
                  </span>
                </span>
                {entry.register !== "neutral" && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium ${
                      entry.register === "vulgar" ? "bg-accent-soft text-accent-text" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {t.register[entry.register]}
                  </span>
                )}
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted/60" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <StateView
          Icon={SearchX}
          headingLevel={2}
          title={t.noResultsTitle}
          body={t.noResults}
          action={
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setKind("all");
              }}
              className="pressable h-11 rounded-full px-5 font-semibold text-accent-text hover:bg-accent-soft"
            >
              {t.clearSearch}
            </button>
          }
        />
      )}
    </div>
  );
}
