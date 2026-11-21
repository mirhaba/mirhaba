"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Search, SearchX, Star, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { fillSlot, indexPhrases, type Phrase, type QuickTalkContent } from "@/lib/content/model";
import { listFavorites, toggleFavorite } from "@/lib/offline-db";
import { normalizeForSearch } from "@/lib/text";
import { CategoryIcon } from "@/components/icons";
import { StateView } from "@/components/state-view";
import { Toast } from "@/components/toast";
import { PhraseSheet } from "./phrase-sheet";

type T = Messages["quickTalk"];

/**
 * Merge favourites with the account (signed in only). The sync code is loaded on demand and
 * started when the browser is idle (after `delayMs`), so it never competes with the first screen.
 */
function syncWhenIdle(onChanged: () => void, delayMs = 0) {
  const run = () =>
    import("@/lib/favorites/sync")
      .then((m) => m.syncFavoritesWithAccount())
      .then((changed) => {
        if (changed) onChanged();
      })
      .catch(() => {});
  const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(run, { timeout: 3000 }) : setTimeout(run, 200));
  setTimeout(idle, delayMs);
}

export function QuickTalk({
  lang,
  t,
  closeLabel,
  content,
}: {
  lang: Locale;
  t: T;
  closeLabel: string;
  /** Categories, phrases and reply buttons from the database (cached; edited in the admin). */
  content: QuickTalkContent;
}) {
  const { categories, replies } = content;
  const phraseById = useMemo(() => indexPhrases(categories), [categories]);
  const searchIndex = useMemo(
    () =>
      categories.flatMap((c) =>
        c.phrases.map((p) => ({
          phrase: p,
          haystack: normalizeForSearch(
            `${p.tr} ${p.sq} ${(p.slot ?? []).map((o) => `${o.tr} ${o.sq}`).join(" ")} ${c.name.tr} ${c.name.sq}`,
          ),
        })),
      ),
    [categories],
  );
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[] | null>(null); // null = still loading
  const [open, setOpen] = useState<Phrase | null>(null);
  const [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const refreshFavorites = useCallback(() => {
    void listFavorites().then(setFavorites);
  }, []);

  useEffect(() => {
    // This phone's pins first (instant, offline), then the account's in the background.
    void listFavorites().then((list) => {
      setFavorites(list);
      syncWhenIdle(refreshFavorites, 1500); // let the first screen settle first
    });
  }, [refreshFavorites]);

  const onToggleFavorite = useCallback(
    async (id: string) => {
      try {
        const next = await toggleFavorite(id);
        if (next === null) setToast(t.favoritesFull);
        else {
          setFavorites(next);
          syncWhenIdle(refreshFavorites);
        }
      } catch {
        setToast(t.saveError);
      }
    },
    [t.favoritesFull, t.saveError, refreshFavorites],
  );

  const category = categories.find((c) => c.slug === categorySlug) ?? categories[0] ?? { slug: "", name: { tr: "", sq: "" }, icon: "", basic: false, phrases: [] };
  const q = normalizeForSearch(query);
  const results = useMemo(
    () => (q ? searchIndex.filter((e) => e.haystack.includes(q)).map((e) => e.phrase) : null),
    [q, searchIndex],
  );
  const favoritePhrases = (favorites ?? []).map((id) => phraseById[id]?.phrase).filter(Boolean) as Phrase[];

  const list = (phrases: Phrase[], key: string) => (
    // `key` re-mounts the list so a new category fades in instead of popping.
    <ul key={key} className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
      {phrases.map((p, i) => (
        <PhraseRow
          key={p.id}
          index={i}
          phrase={p}
          lang={lang}
          t={t}
          pinned={!!favorites?.includes(p.id)}
          onOpen={() => setOpen(p)}
          onToggleFavorite={() => onToggleFavorite(p.id)}
        />
      ))}
    </ul>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div>
        <h1 className="text-[34px] leading-tight font-bold">{t.title}</h1>
        <p className="mt-1 text-[15px] text-muted">{t.subtitle}</p>
      </div>

      <div>
        <label htmlFor="qt-search" className="mb-1.5 block text-[13px] font-medium text-muted">
          {t.searchLabel}
        </label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            id="qt-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            enterKeyHint="search"
            autoComplete="off"
            className="h-12 w-full rounded-xl bg-surface-2 pr-11 pl-10 text-[17px] transition-shadow duration-150 outline-none placeholder:text-muted/70 focus:ring-2 focus:ring-accent-text/40 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              aria-label={t.clearSearch}
              className="pressable absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted"
            >
              <X aria-hidden="true" className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>

      {results ? (
        <section aria-live="polite" aria-label={t.searchLabel}>
          {results.length ? (
            list(results, `search-${q}`)
          ) : (
            <StateView
              Icon={SearchX}
              headingLevel={2}
              title={t.noResultsTitle}
              body={t.noResults}
              action={
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="pressable h-11 rounded-full px-5 font-semibold text-accent-text hover:bg-accent-soft"
                >
                  {t.clearSearch}
                </button>
              }
            />
          )}
        </section>
      ) : (
        <>
          <section aria-labelledby="fav-heading">
            <h2 id="fav-heading" className="mb-2 text-[20px] font-semibold">
              {t.favorites}
            </h2>
            {favorites === null ? (
              <FavoritesSkeleton label={t.favorites} />
            ) : favoritePhrases.length ? (
              list(favoritePhrases, `fav-${favorites.join()}`)
            ) : (
              <div className="fade-in flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                  <Star aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-medium">{t.favoritesEmptyTitle}</p>
                  <p className="text-[13px] text-muted">{t.favoritesEmpty}</p>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="cat-heading" className="min-w-0">
            <h2 id="cat-heading" className="mb-2 text-[20px] font-semibold">
              {t.categories}
            </h2>
            <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-1">
              <ul className="flex w-max gap-2">
                {categories.map((c) => {
                  const selected = c.slug === category.slug;
                  return (
                    <li key={c.slug}>
                      <button
                        type="button"
                        onClick={() => setCategorySlug(c.slug)}
                        aria-pressed={selected}
                        className={`pressable flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium whitespace-nowrap ${
                          selected
                            ? "bg-accent text-on-accent"
                            : "bg-surface text-foreground shadow-card ring-1 ring-hairline hover:bg-surface-2"
                        }`}
                      >
                        <CategoryIcon name={c.icon} className="h-[18px] w-[18px]" />
                        {c.name[lang]}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mt-3">{list(category.phrases, `cat-${category.slug}`)}</div>
          </section>
        </>
      )}

      <Toast message={toast} onDone={() => setToast("")} />

      {open && <PhraseSheet phrase={open} replies={replies} lang={lang} t={t} closeLabel={closeLabel} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PhraseRow({
  phrase,
  index,
  lang,
  t,
  pinned,
  onOpen,
  onToggleFavorite,
}: {
  phrase: Phrase;
  index: number;
  lang: Locale;
  t: T;
  pinned: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  // The user's own language on top (what they mean), the other language underneath.
  const primary = lang === "tr" ? phrase.tr : phrase.sq;
  const secondary = lang === "tr" ? phrase.sq : phrase.tr;

  return (
    <li
      className="fade-in flex items-stretch border-b border-hairline last:border-b-0"
      style={{ "--i": index } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={onOpen}
        className="group flex min-h-[60px] flex-1 items-center gap-3 py-2.5 pl-4 text-left transition-colors duration-150 active:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] leading-snug font-medium">{fillSlot(primary)}</span>
          <span lang={lang === "tr" ? "sq" : "tr"} className="block text-[15px] leading-snug text-muted">
            {fillSlot(secondary)}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted/60" />
      </button>
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-pressed={pinned}
        aria-label={pinned ? t.unpin : t.pin}
        className={`pressable flex w-14 shrink-0 items-center justify-center ${pinned ? "text-accent-text" : "text-muted/70 hover:text-muted"}`}
      >
        <Star aria-hidden="true" className="h-[22px] w-[22px]" fill={pinned ? "currentColor" : "none"} strokeWidth={1.75} />
      </button>
    </li>
  );
}

function FavoritesSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0">
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-3/5 rounded" />
            <div className="skeleton h-3.5 w-2/5 rounded" />
          </div>
          <div className="skeleton h-5 w-5 rounded-full" />
        </div>
      ))}
    </div>
  );
}
