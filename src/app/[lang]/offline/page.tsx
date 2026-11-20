import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { StateView } from "@/components/state-view";
import { LogoMark } from "@/components/brand/Logo";

export const metadata = { robots: { index: false } };

// Precached by the service worker and shown when a page isn't available offline.
export default async function OfflinePage({ params }: PageProps<"/[lang]/offline">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = await getDictionary(lang);
  return <StateView visual={<LogoMark height={72} />} title={t.offline.title} body={t.offline.body} action={{ label: t.offline.cta, href: `/${lang}` }} />;
}
