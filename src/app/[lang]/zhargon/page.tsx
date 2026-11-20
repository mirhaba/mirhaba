import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DictionaryIndexPage, dictionaryIndexMetadata } from "@/components/dictionary/dictionary-pages";

// The dictionary index for "sq" (other languages are redirected here by next.config.ts).
export async function generateMetadata({ params }: PageProps<"/[lang]/zhargon">): Promise<Metadata> {
  const { lang } = await params;
  return lang === "sq" ? dictionaryIndexMetadata("sq") : {};
}

export default async function Page({ params }: PageProps<"/[lang]/zhargon">) {
  const { lang } = await params;
  if (lang !== "sq") notFound();
  return <DictionaryIndexPage lang="sq" />;
}
