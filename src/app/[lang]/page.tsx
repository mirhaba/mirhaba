import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { QuickTalk } from "@/components/quick-talk/quick-talk";
import { getQuickTalk } from "@/lib/content/queries";

// The app opens straight into Quick Talk: that's what someone at a door needs first.
export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [t, content] = await Promise.all([getDictionary(lang), getQuickTalk()]);

  return <QuickTalk lang={lang} t={t.quickTalk} closeLabel={t.common.close} content={content} />;
}
