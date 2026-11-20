import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { MainNavLinks } from "./main-nav-links";

/** Thumb-reachable glass tab bar on phones; on wider screens the links live in the header. */
export function BottomNav({ lang, t }: { lang: Locale; t: Messages }) {
  return (
    <nav
      aria-label={t.nav.main}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-glass pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 sm:hidden"
    >
      <Suspense fallback={<div className="h-14" />}>
        <MainNavLinks lang={lang} t={t.nav} variant="bottom" />
      </Suspense>
    </nav>
  );
}
