import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allSlugs, WordPage, wordMetadata } from "@/components/dictionary/dictionary-pages";

// One static, indexable page per word, e.g. /sq/zhargon/qysh.
export function generateStaticParams() {
  return allSlugs();
}

export async function generateMetadata({ params }: PageProps<"/[lang]/zhargon/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  return lang === "sq" ? wordMetadata("sq", slug) : {};
}

export default async function Page({ params }: PageProps<"/[lang]/zhargon/[slug]">) {
  const { lang, slug } = await params;
  if (lang !== "sq") notFound();
  return <WordPage lang="sq" slug={slug} />;
}
