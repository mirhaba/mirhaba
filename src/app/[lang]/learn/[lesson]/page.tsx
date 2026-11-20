import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { lessonBySlug, lessonList } from "@/content/lessons";
import { LessonPlayer } from "../player/lesson-player";

export function generateStaticParams() {
  return lessonList.map(({ lesson }) => ({ lesson: lesson.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/learn/[lesson]">): Promise<Metadata> {
  const { lang, lesson } = await params;
  const ref = lessonBySlug[lesson];
  if (!hasLocale(lang) || !ref) return {};
  const t = (await getDictionary(lang)).learn;
  // Interactive lesson screens are not search landing pages; /learn is.
  return { title: `${ref.lesson.title[lang]} · ${t.title}`, robots: { index: false, follow: true } };
}

export default async function LessonPage({ params }: PageProps<"/[lang]/learn/[lesson]">) {
  const { lang, lesson } = await params;
  const ref = lessonBySlug[lesson];
  if (!hasLocale(lang) || !ref || !ref.unit.isFree) notFound(); // Premium units unlock with payments
  const t = (await getDictionary(lang)).learn;
  const next = lessonList.slice(ref.index + 1).find((r) => r.unit.isFree);

  return (
    <div className="mx-auto w-full max-w-xl">
      <LessonPlayer
        lang={lang}
        t={t}
        mode="lesson"
        lessonSlug={ref.lesson.slug}
        items={ref.lesson.items}
        nextLessonSlug={next?.lesson.slug}
      />
    </div>
  );
}
