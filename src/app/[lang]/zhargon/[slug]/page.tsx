import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allSlugs, WordPage, WordPageSkeleton, wordMetadata } from "@/components/dictionary/dictionary-pages";

// One static, indexable page per word, e.g. /sq/zhargon/qysh.
export function generateStaticParams() {
  return allSlugs();
}

export async function generateMetadata({ params }: PageProps<"/[lang]/zhargon/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  return lang === "sq" ? wordMetadata("sq", slug) : {};
}

// Params are read inside Suspense so client navigation can show the skeleton at once;
// every word is in generateStaticParams, so the pages are still prerendered.
export default function Page({ params }: PageProps<"/[lang]/zhargon/[slug]">) {
  return (
    <Suspense fallback={<WordPageSkeleton />}>
      <Word params={params} />
    </Suspense>
  );
}

async function Word({ params }: { params: PageProps<"/[lang]/zhargon/[slug]">["params"] }) {
  const { lang, slug } = await params;
  if (lang !== "sq") notFound();
  return <WordPage lang="sq" slug={slug} />;
}
