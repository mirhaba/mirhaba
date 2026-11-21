import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Crown, Hourglass } from "lucide-react";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Messages } from "@/i18n/dictionaries";
import { indexLessons, type Item, type LessonRef } from "@/lib/content/model";
import { getTracks } from "@/lib/content/queries";
import { getEntitlement } from "@/lib/billing/entitlement";
import { StateView } from "@/components/state-view";
import { LessonPlayer } from "../player/lesson-player";

export async function generateStaticParams() {
  return indexLessons(await getTracks()).lessonList.map(({ lesson }) => ({ lesson: lesson.slug }));
}

/** Lessons from the database, with lookups. */
async function lessons() {
  return indexLessons(await getTracks());
}

export async function generateMetadata({ params }: PageProps<"/[lang]/learn/[lesson]">): Promise<Metadata> {
  const { lang, lesson } = await params;
  const ref = (await lessons()).lessonBySlug[lesson];
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
  const { lessonList, lessonBySlug } = await lessons();
  const ref = lessonBySlug[lesson];
  if (!hasLocale(lang) || !ref) notFound();
  const t = await getDictionary(lang);
  const next = lessonList[ref.index + 1]?.lesson.slug;
  // Wrong-answer options: words from free units plus this lesson (Premium words never reach free lessons).
  const allItems = [...new Map(lessonList.filter((r) => r.unit.isFree || r === ref).flatMap((r) => r.lesson.items).map((i) => [i.id, i])).values()];
  const heading = <h1 className="sr-only">{ref.lesson.title[lang]}</h1>; // the player itself has no page title

  // A lesson saved in the admin without words yet: say so instead of starting an empty player.
  if (ref.lesson.items.length === 0) {
    return (
      <>
        <StateView
          Icon={Hourglass}
          title={t.common.comingSoon}
          body={t.common.comingSoonBody}
          action={
            <Link href={`/${lang}/learn`} className="inline-flex h-11 items-center justify-center text-[15px] font-medium text-accent-text">
              {t.learn.player.backToLessons}
            </Link>
          }
        />
      </>
    );
  }

  if (ref.unit.isFree) {
    return (
      <>
        {heading}
        <Player lang={lang} t={t.learn} lessonRef={ref} allItems={allItems} next={next} />
      </>
    );
  }
  // Premium lessons check the account on every request; only this part waits.
  return (
    <>
      {heading}
      <Suspense fallback={<LessonSkeleton />}>
        <PremiumLesson lang={lang} t={t} lessonRef={ref} allItems={allItems} next={next} />
      </Suspense>
    </>
  );
}

type PlayerProps = { lang: Locale; lessonRef: LessonRef; allItems: Item[]; next?: string };

// `next`: the following lesson. If it's Premium and the learner isn't, that page explains how to unlock it.
function Player({ lang, t, lessonRef, allItems, next }: PlayerProps & { t: Messages["learn"] }) {
  return (
    <LessonPlayer
      lang={lang}
      t={t}
      mode="lesson"
      lessonSlug={lessonRef.lesson.slug}
      items={lessonRef.lesson.items}
      allItems={allItems}
      nextLessonSlug={next}
    />
  );
}

async function PremiumLesson({ t, ...props }: PlayerProps & { t: Messages }) {
  const { lang, lessonRef } = props;
  const { signedIn, premium } = await getEntitlement();
  if (premium) return <Player {...props} t={t.learn} />;

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
