"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { DICTIONARY_SEGMENT } from "@/lib/site";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Apple-style segmented control: TR | SQ. */
export function LanguageSwitcher({ lang, label, switchLabel }: { lang: Locale; label: string; switchLabel: string }) {
  const pathname = usePathname() ?? `/${lang}`;
  const other: Locale = lang === "tr" ? "sq" : "tr";
  // The dictionary has a localized path (/tr/argo ↔ /sq/zhargon): link there directly instead of via a redirect.
  const rest = pathname
    .replace(/^\/(tr|sq)(?=\/|$)/, "")
    .replace(new RegExp(`^/${DICTIONARY_SEGMENT[lang]}(?=/|$)`), `/${DICTIONARY_SEGMENT[other]}`);
  const href = `/${other}${rest}`;

  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-surface-2 p-0.5 text-[13px] font-semibold">
      {(["tr", "sq"] as const).map((code) =>
        code === lang ? (
          <span
            key={code}
            aria-current="true"
            className="flex h-9 min-w-10 items-center justify-center rounded-full bg-surface px-2.5 text-foreground shadow-card min-[360px]:min-w-11 min-[360px]:px-3"
          >
            {code.toUpperCase()}
          </span>
        ) : (
          <Link
            key={code}
            href={href}
            hrefLang={other}
            aria-label={switchLabel}
            onClick={() => {
              document.cookie = `${LOCALE_COOKIE}=${other}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
            }}
            className="pressable flex h-9 min-w-10 items-center justify-center rounded-full px-2.5 text-muted hover:text-foreground min-[360px]:min-w-11 min-[360px]:px-3"
          >
            {code.toUpperCase()}
          </Link>
        ),
      )}
    </div>
  );
}
