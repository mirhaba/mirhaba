import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import "../globals.css";
import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorker } from "@/components/service-worker";
import { InstallPrompt } from "@/components/install-prompt";
import { CookieConsent } from "@/components/cookie-consent";
import { Analytics } from "@/components/analytics";
import { siteUrl } from "@/lib/site";
import { AuthLinkHandler } from "@/components/auth-link-handler";
import { FirstRunGuide } from "@/components/first-run-guide";
import { SignupWelcome } from "@/components/signup-welcome";
import { PREFERENCES_BOOT_SCRIPT } from "@/lib/preferences-boot";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"], // Turkish (ğ ş ı İ) and Albanian (ë ç)
  weight: ["400", "700"],
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = await getDictionary(lang);
  return {
    metadataBase: new URL(siteUrl),
    title: { default: t.meta.title, template: "%s · Mirhaba" },
    description: t.meta.description,
    applicationName: "Mirhaba",
    alternates: {
      canonical: `/${lang}`,
      languages: { tr: "/tr", sq: "/sq", "x-default": "/tr" },
    },
    openGraph: {
      type: "website",
      siteName: "Mirhaba",
      title: t.meta.title,
      description: t.meta.description,
      locale: lang === "tr" ? "tr_TR" : "sq_XK",
    },
    twitter: { card: "summary_large_image" },
    appleWebApp: { capable: true, title: "Mirhaba", statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#C1272D",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  // The first-run guide has its own TR/SQ toggle, so it needs its texts in both languages.
  const [t, other] = await Promise.all([getDictionary(lang), getDictionary(lang === "tr" ? "sq" : "tr")]);
  const guideTexts = lang === "tr" ? { tr: t.guide, sq: other.guide } : { tr: other.guide, sq: t.guide };

  return (
    // suppressHydrationWarning: the boot script sets data-theme / data-text / data-motion before React hydrates.
    <html lang={lang} className={`${dmSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Applies saved preferences (dark theme, larger text, less motion) before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-accent px-4 py-3 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t.common.skipToContent}
        </a>
        <AuthLinkHandler lang={lang} />
        <SiteHeader lang={lang} t={t} />
        <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-10">
          {children}
        </main>
        <SiteFooter lang={lang} t={t} />
        <BottomNav lang={lang} t={t} />
        <Suspense>
          <InstallPrompt t={t.install} />
        </Suspense>
        <CookieConsent lang={lang} t={t.cookies} />
        <FirstRunGuide lang={lang} texts={guideTexts} />
        <SignupWelcome lang={lang} t={t.welcome} prefs={{ goalNames: t.prefs.goalNames, lessonsN: t.prefs.lessonsN }} />
        <Analytics />
        <ServiceWorker />
      </body>
    </html>
  );
}
