import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Messages } from "@/i18n/dictionaries";
import { FREE_TEXT_TRANSLATIONS_PER_DAY, MAX_TRANSLATION_CHARS } from "@/lib/plans";
import { getUser } from "@/lib/supabase/server";
import { Translator } from "./translator";

export async function generateMetadata({ params }: PageProps<"/[lang]/translate">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = await getDictionary(lang);
  return { title: t.translate.title, description: t.translate.subtitle };
}

export default async function TranslatePage({ params }: PageProps<"/[lang]/translate">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[34px] leading-tight font-bold">{t.translate.title}</h1>
        <p className="mt-1 text-[15px] text-muted">{t.translate.subtitle}</p>
      </div>
      {/* Only the signed-in check waits for the request; the heading above is static. */}
      <Suspense fallback={<TranslatorSkeleton />}>
        <TranslatorWithSession lang={lang} t={t} />
      </Suspense>
      <p className="text-[13px] text-muted">{t.translate.disclaimer}</p>
    </div>
  );
}

async function TranslatorWithSession({ lang, t }: { lang: Locale; t: Messages }) {
  const user = await getUser();
  return (
    <Translator
      lang={lang}
      t={t.translate}
      signedIn={!!user}
      freeLimit={FREE_TEXT_TRANSLATIONS_PER_DAY}
      maxChars={MAX_TRANSLATION_CHARS}
    />
  );
}

function TranslatorSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="skeleton h-11 rounded-xl" />
      <div className="skeleton h-11 w-1/2 rounded-xl" />
      <div className="space-y-1.5">
        <div className="skeleton h-3.5 w-24 rounded" />
        <div className="skeleton h-36 rounded-2xl" />
      </div>
      <div className="skeleton h-12 rounded-full" />
    </div>
  );
}
