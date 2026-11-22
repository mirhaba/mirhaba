import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/dictionaries";
import { legalPages } from "@/lib/site";
import { CookieSettingsLink } from "./cookie-consent";
import { Logo } from "./brand/Logo";
import { BusinessDetails } from "./business-details";
import { OpenGuideButton } from "./first-run-guide";

export function SiteFooter({ lang, t }: { lang: Locale; t: Messages }) {
  return (
    <footer className="border-t border-hairline pb-20 sm:pb-0">
      <div className="mx-auto max-w-3xl px-4 py-6 text-[13px] text-muted">
        <Link href={`/${lang}`} aria-label="Mirhaba" className="mb-3 inline-flex rounded-lg">
          <Logo size="sm" />
        </Link>
        <ul className="-mx-2 flex flex-wrap">
          {(["about", "pricing", "faq"] as const).map((page) => (
            <li key={page}>
              <Link href={`/${lang}/${page}`} className="inline-flex min-h-11 items-center px-2 font-medium text-foreground hover:text-accent-text">
                {t.footer[page]}
              </Link>
            </li>
          ))}
          <li>
            <OpenGuideButton
              label={t.guide.howTo}
              className="inline-flex min-h-11 items-center px-2 font-medium text-foreground hover:text-accent-text"
            />
          </li>
        </ul>
        <ul className="-mx-2 flex flex-wrap">
          {legalPages.map((page) => (
            <li key={page}>
              <Link href={`/${lang}/legal/${page}`} className="inline-flex min-h-11 items-center px-2 hover:text-foreground">
                {t.footer[page]}
              </Link>
            </li>
          ))}
          <li>
            <CookieSettingsLink label={t.cookies.footerLink} />
          </li>
        </ul>
        <p className="mt-2">{t.footer.disclaimer}</p>
        <BusinessDetails t={t.footer} variant="inline" />
        <p className="mt-1">© Mirhaba</p>
      </div>
    </footer>
  );
}
