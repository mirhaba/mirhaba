"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Apple-style segmented control: TR | SQ. */
export function LanguageSwitcher({ lang, label, switchLabel }: { lang: Locale; label: string; switchLabel: string }) {
  const pathname = usePathname() ?? `/${lang}`;
  const other: Locale = lang === "tr" ? "sq" : "tr";
  const href = `/${other}${pathname.replace(/^\/(tr|sq)(?=\/|$)/, "")}`;

  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-surface-2 p-0.5 text-[13px] font-semibold">
      {(["tr", "sq"] as const).map((code) =>
        code === lang ? (
          <span
            key={code}
            aria-current="true"
            className="flex h-9 min-w-11 items-center justify-center rounded-full bg-surface px-3 text-foreground shadow-card"
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
            className="pressable flex h-9 min-w-11 items-center justify-center rounded-full px-3 text-muted hover:text-foreground"
          >
            {code.toUpperCase()}
          </Link>
        ),
      )}
    </div>
  );
}
