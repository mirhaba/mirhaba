import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { QuickTalk } from "@/components/quick-talk/quick-talk";

// The app opens straight into Quick Talk: that's what someone at a door needs first.
export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);

  return <QuickTalk lang={lang} t={t.quickTalk} closeLabel={t.common.close} />;
}
