import Link from "next/link";
import { Suspense } from "react";
import { CircleUserRound } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./brand/Logo";
import { MainNavLinks } from "./main-nav-links";

/** Glass bar: logo on the left (strong logo location), nav in the middle on wide screens, language on the right. */
export function SiteHeader({ lang, t }: { lang: Locale; t: Messages }) {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-glass backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <Link href={`/${lang}`} className="pressable flex items-center rounded-lg" aria-label="Mirhaba">
          <Logo size="md" />
        </Link>
        <nav aria-label={t.nav.main} className="ml-2 hidden flex-1 sm:block">
          <Suspense>
            <MainNavLinks lang={lang} t={t.nav} variant="top" />
          </Suspense>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {/* Static link; the proxy sends signed-out visitors to the login page. */}
          <Link
            href={`/${lang}/app`}
            aria-label={t.nav.account}
            className="pressable flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-foreground"
          >
            <CircleUserRound aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
          </Link>
          <Suspense fallback={<span className="block h-9 w-[5.5rem] rounded-full bg-surface-2" />}>
            <LanguageSwitcher lang={lang} label={t.common.language} switchLabel={t.common.switchTo} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
