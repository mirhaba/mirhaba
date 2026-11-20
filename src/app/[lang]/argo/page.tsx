import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DictionaryIndexPage, dictionaryIndexMetadata } from "@/components/dictionary/dictionary-pages";

// The dictionary index for "tr" (other languages are redirected here by next.config.ts).
export async function generateMetadata({ params }: PageProps<"/[lang]/argo">): Promise<Metadata> {
  const { lang } = await params;
  return lang === "tr" ? dictionaryIndexMetadata("tr") : {};
}

export default async function Page({ params }: PageProps<"/[lang]/argo">) {
  const { lang } = await params;
  if (lang !== "tr") notFound();
  return <DictionaryIndexPage lang="tr" />;
}
