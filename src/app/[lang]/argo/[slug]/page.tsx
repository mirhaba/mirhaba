import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allSlugs, WordPage, wordMetadata } from "@/components/dictionary/dictionary-pages";

// One static, indexable page per word, e.g. /tr/argo/qysh.
export function generateStaticParams() {
  return allSlugs();
}

export async function generateMetadata({ params }: PageProps<"/[lang]/argo/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  return lang === "tr" ? wordMetadata("tr", slug) : {};
}

export default async function Page({ params }: PageProps<"/[lang]/argo/[slug]">) {
  const { lang, slug } = await params;
  if (lang !== "tr") notFound();
  return <WordPage lang="tr" slug={slug} />;
}
