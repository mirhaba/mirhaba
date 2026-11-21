import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { LessonPlayer } from "../player/lesson-player";
import { getTracks } from "@/lib/content/queries";

export async function generateMetadata({ params }: PageProps<"/[lang]/learn/review">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).learn;
  return { title: t.reviewTitle, robots: { index: false, follow: true } };
}

// Weak words come from this device (IndexedDB), so the list is read in the browser.
export default async function ReviewPage({ params }: PageProps<"/[lang]/learn/review">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [t, tracks] = await Promise.all([getDictionary(lang).then((m) => m.learn), getTracks()]);
  // Free units only: this page is static and shared by everyone, so Premium words never ship here.
  const allItems = tracks.flatMap((tr) => tr.units.filter((u) => u.isFree).flatMap((u) => u.lessons.flatMap((l) => l.items)));
  return (
    <div className="mx-auto w-full max-w-xl">
      <LessonPlayer lang={lang} t={t} mode="review" allItems={allItems} />
    </div>
  );
}
