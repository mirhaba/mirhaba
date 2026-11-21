import type { MetadataRoute } from "next";
import { getDictionaryEntries } from "@/lib/content/queries";
import { dictionaryPath, legalPages, siteUrl } from "@/lib/site";

type Entry = MetadataRoute.Sitemap[number];

/** One sitemap row per language version, each pointing at its alternates (hreflang). */
function pair(tr: string, sq: string, extra: Partial<Entry>): MetadataRoute.Sitemap {
  const alternates = { languages: { tr: `${siteUrl}${tr}`, sq: `${siteUrl}${sq}` } };
  return [
    { url: `${siteUrl}${tr}`, alternates, ...extra },
    { url: `${siteUrl}${sq}`, alternates, ...extra },
  ];
}

// Public, indexable pages only (no /app, /login, /offline).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slang = await getDictionaryEntries();
  return [
    ...pair("/tr", "/sq", { changeFrequency: "weekly", priority: 1 }),
    ...pair("/tr/about", "/sq/about", { changeFrequency: "monthly", priority: 0.9 }),
    ...pair("/tr/pricing", "/sq/pricing", { changeFrequency: "monthly", priority: 0.8 }),
    ...pair("/tr/faq", "/sq/faq", { changeFrequency: "monthly", priority: 0.7 }),
    ...pair("/tr/translate", "/sq/translate", { changeFrequency: "monthly", priority: 0.8 }),
    ...pair("/tr/learn", "/sq/learn", { changeFrequency: "weekly", priority: 0.8 }),
    ...pair(dictionaryPath("tr"), dictionaryPath("sq"), { changeFrequency: "weekly", priority: 0.9 }),
    ...slang.flatMap((entry) =>
      pair(dictionaryPath("tr", entry.slug), dictionaryPath("sq", entry.slug), { changeFrequency: "monthly", priority: 0.7 }),
    ),
    ...legalPages.flatMap((p) => pair(`/tr/legal/${p}`, `/sq/legal/${p}`, { changeFrequency: "yearly", priority: 0.3 })),
  ];
}
