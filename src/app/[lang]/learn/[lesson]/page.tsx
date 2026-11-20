import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Crown } from "lucide-react";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Messages } from "@/i18n/dictionaries";
import { lessonBySlug, lessonList, type LessonRef } from "@/content/lessons";
import { getEntitlement } from "@/lib/billing/entitlement";
import { StateView } from "@/components/state-view";
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

export default function LessonPage({ params }: PageProps<"/[lang]/learn/[lesson]">) {
  // Params are read inside Suspense so navigation shows the skeleton at once.
  // Every lesson is in generateStaticParams, so free lessons are still prerendered (and work offline).
  return (
    <div className="mx-auto w-full max-w-xl">
      <Suspense fallback={<LessonSkeleton />}>
        <Lesson params={params} />
      </Suspense>
    </div>
  );
}

async function Lesson({ params }: { params: PageProps<"/[lang]/learn/[lesson]">["params"] }) {
  const { lang, lesson } = await params;
  const ref = lessonBySlug[lesson];
  if (!hasLocale(lang) || !ref) notFound();
  const t = await getDictionary(lang);

  if (ref.unit.isFree) return <Player lang={lang} t={t.learn} lessonRef={ref} />;
  // Premium lessons check the account on every request; only this part waits.
  return (
    <Suspense fallback={<LessonSkeleton />}>
      <PremiumLesson lang={lang} t={t} lessonRef={ref} />
    </Suspense>
  );
}

function Player({ lang, t, lessonRef }: { lang: Locale; t: Messages["learn"]; lessonRef: LessonRef }) {
  // The next lesson in order. If it's Premium and the learner isn't, that page explains how to unlock it.
  const next = lessonList[lessonRef.index + 1];
  return (
    <LessonPlayer
      lang={lang}
      t={t}
      mode="lesson"
      lessonSlug={lessonRef.lesson.slug}
      items={lessonRef.lesson.items}
      nextLessonSlug={next?.lesson.slug}
    />
  );
}

async function PremiumLesson({ lang, t, lessonRef }: { lang: Locale; t: Messages; lessonRef: LessonRef }) {
  const { signedIn, premium } = await getEntitlement();
  if (premium) return <Player lang={lang} t={t.learn} lessonRef={lessonRef} />;

  const back = `/${lang}/learn/${lessonRef.lesson.slug}`;
  return (
    <StateView
      Icon={Crown}
      title={t.learn.lockedTitle}
      body={signedIn ? t.learn.lockedBody : `${t.learn.lockedBody} ${t.learn.lockedSignInHint}`}
      action={
        <div className="flex flex-col items-center gap-3">
          <Link
            href={`/${lang}/pricing`}
            className="pressable inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 font-semibold text-on-accent hover:bg-accent-pressed"
          >
            {t.learn.seePremium}
          </Link>
          {!signedIn && (
            <Link href={`/${lang}/login?next=${encodeURIComponent(back)}`} className="text-[15px] font-medium text-accent-text">
              {t.learn.signIn}
            </Link>
          )}
        </div>
      }
    />
  );
}

function LessonSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4 py-2">
      <div className="skeleton h-2 w-full rounded-full" />
      <div className="skeleton h-8 w-2/3 rounded-lg" />
      <div className="skeleton h-40 rounded-2xl" />
      <div className="skeleton h-12 rounded-full" />
    </div>
  );
}
