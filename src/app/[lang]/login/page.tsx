import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/brand/Logo";

export async function generateMetadata({ params }: PageProps<"/[lang]/login">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = await getDictionary(lang);
  return { title: t.auth.title, robots: { index: false } };
}

// Signed-in visitors are sent to /app by the proxy, so this page stays static.
export default async function LoginPage({ params }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-8 py-4">
      <Logo size="lg" showWordmark={false} className="-mb-4" />
      {/* The form renders the heading: it changes between "Sign in" and "Create account". */}
      <Suspense fallback={<LoginSkeleton title={t.auth.title} subtitle={t.auth.subtitle} />}>
        <LoginForm lang={lang} t={t.auth} />
      </Suspense>
      <p className="text-center text-[13px] text-muted">
        <Link href={`/${lang}/legal/terms`} className="inline-flex min-h-11 items-center px-1 hover:text-foreground">
          {t.footer.terms}
        </Link>
        {" · "}
        <Link href={`/${lang}/legal/privacy`} className="inline-flex min-h-11 items-center px-1 hover:text-foreground">
          {t.footer.privacy}
        </Link>
      </p>
    </div>
  );
}

function LoginSkeleton({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[34px] leading-tight font-bold">{title}</h1>
        <p className="mt-1 text-[15px] text-muted">{subtitle}</p>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-5">
        <div className="skeleton h-12 rounded-xl" />
        {[0, 1].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="skeleton h-3.5 w-16 rounded" />
            <div className="skeleton h-12 rounded-xl" />
          </div>
        ))}
        <div className="skeleton h-12 rounded-full" />
      </div>
    </div>
  );
}
