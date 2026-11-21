import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allSlugs, WordPage, WordPageSkeleton, wordMetadata } from "@/components/dictionary/dictionary-pages";

// One static, indexable page per word, e.g. /tr/argo/qysh.
export function generateStaticParams() {
  return allSlugs();
}

export async function generateMetadata({ params }: PageProps<"/[lang]/argo/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  return lang === "tr" ? wordMetadata("tr", slug) : {};
}

// Params are read inside Suspense so client navigation can show the skeleton at once;
// every word is in generateStaticParams, so the pages are still prerendered.
export default function Page({ params }: PageProps<"/[lang]/argo/[slug]">) {
  return (
    <Suspense fallback={<WordPageSkeleton />}>
      <Word params={params} />
    </Suspense>
  );
}

async function Word({ params }: { params: PageProps<"/[lang]/argo/[slug]">["params"] }) {
  const { lang, slug } = await params;
  if (lang !== "tr") notFound();
  return <WordPage lang="tr" slug={slug} />;
}
