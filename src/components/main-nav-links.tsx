"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, GraduationCap, Languages, MessageCircle, type LucideIcon } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { sectionHref } from "@/lib/site";

const items: { key: "quickTalk" | "translate" | "learn" | "dictionary"; Icon: LucideIcon }[] = [
  { key: "quickTalk", Icon: MessageCircle },
  { key: "translate", Icon: Languages },
  { key: "learn", Icon: GraduationCap },
  { key: "dictionary", Icon: BookOpen },
];

export function MainNavLinks({ lang, t, variant }: { lang: Locale; t: Messages["nav"]; variant: "top" | "bottom" }) {
  const pathname = usePathname();

  return (
    <ul className={variant === "bottom" ? "grid grid-cols-4" : "flex gap-1"}>
      {items.map(({ key, Icon }) => {
        const href = sectionHref(key, lang);
        const active = key === "quickTalk" ? pathname === href : !!pathname?.startsWith(href);
        return (
          <li key={key}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                variant === "bottom"
                  ? `pressable flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium ${
                      active ? "text-accent-text" : "text-muted"
                    }`
                  : `pressable flex h-9 items-center rounded-full px-3 text-sm font-medium ${
                      active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                    }`
              }
            >
              {variant === "bottom" && <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={active ? 2.25 : 1.75} />}
              <span className="text-center leading-tight">{t[key]}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
