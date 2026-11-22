import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { LearnHome, LearnTitle } from "./learn-home";
import { getTracks } from "@/lib/content/queries";

export async function generateMetadata({ params }: PageProps<"/[lang]/learn">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).learn;
  return {
    title: t.title,
    description: t.metaDescription,
    alternates: { canonical: `/${lang}/learn`, languages: { tr: "/tr/learn", sq: "/sq/learn", "x-default": "/tr/learn" } },
  };
}

export default async function LearnPage({ params }: PageProps<"/[lang]/learn">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (await getDictionary(lang)).learn;

  return (
    <div className="flex flex-col gap-6">
      <LearnTitle t={t} />
      {/* The list needs titles only; lesson words stay on the lesson pages. */}
      <LearnHome
        lang={lang}
        t={t}
        tracks={(await getTracks()).map((tr) => ({ ...tr, units: tr.units.map((u) => ({ ...u, lessons: u.lessons.map((l) => ({ ...l, items: [] })) })) }))}
      />
      <div className="space-y-2 text-[13px] text-muted">
        <p className="flex items-start gap-2">
          <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {t.unverified}
        </p>
        <p>{t.deviceNote}</p>
      </div>
    </div>
  );
}
