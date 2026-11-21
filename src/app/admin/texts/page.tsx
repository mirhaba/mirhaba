import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { getDefaultDictionary } from "@/i18n/dictionaries";
import { flattenTexts, type Json } from "@/i18n/text-keys";
import { getUiTextOverrides } from "@/lib/content/queries";
import { normalizeForSearch } from "@/lib/text";
import { ActionForm } from "../_ui/form";
import { Badge, PageHeader, SearchForm, textareaClass } from "../_ui/ui";
import { saveUiText } from "./actions";

export const metadata = { title: "UI text" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function TextsAdmin({ searchParams }: PageProps<"/admin/texts">) {
  await requireAdmin();
  const { q = "", section: sectionParam } = (await searchParams) as { q?: string; section?: string };
  const [trDefaults, sqDefaults, trOver, sqOver] = await Promise.all([
    getDefaultDictionary("tr"),
    getDefaultDictionary("sq"),
    getUiTextOverrides("tr"),
    getUiTextOverrides("sq"),
  ]);
  const tr = flattenTexts(trDefaults as unknown as Json);
  const sq = new Map(flattenTexts(sqDefaults as unknown as Json));
  const sections = [...new Set(tr.map(([k]) => k.split(".")[0]))];
  const changed = new Set([...Object.keys(trOver), ...Object.keys(sqOver)]);

  const needle = normalizeForSearch(q);
  const section = needle ? null : (sectionParam && sections.includes(sectionParam) ? sectionParam : sections[0]);
  const rows = tr.filter(([key, value]) => {
    if (needle) {
      const hay = normalizeForSearch(`${key} ${value} ${sq.get(key) ?? ""} ${trOver[key] ?? ""} ${sqOver[key] ?? ""}`);
      return hay.includes(needle);
    }
    return key.split(".")[0] === section;
  });

  return (
    <>
      <PageHeader
        title="UI text"
        description="Every text on the site, in Turkish and Albanian. Change one and save: the site shows it on the next page load. Keep placeholders like {n} as they are."
      />
      <SearchForm placeholder="Search any text, e.g. Bisedë e shpejtë" defaultValue={q} />
      {!needle && (
        <nav aria-label="Sections" className="mb-4 flex flex-wrap gap-1.5">
          {sections.map((s) => {
            const edits = [...changed].filter((k) => k.split(".")[0] === s).length;
            return (
              <Link
                key={s}
                href={`/admin/texts?section=${s}`}
                aria-current={s === section ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-[13px] font-medium ${s === section ? "bg-accent text-on-accent" : "bg-surface-2 text-muted hover:text-foreground"}`}
              >
                {s}
                {edits > 0 && ` · ${edits}`}
              </Link>
            );
          })}
        </nav>
      )}
      <p className="mb-2 text-[13px] text-muted">{rows.length} texts</p>
      <div className="flex flex-col gap-3">
        {rows.map(([key, trDefault]) => {
          const sqDefault = sq.get(key) ?? "";
          const edited = changed.has(key);
          const long = Math.max(trDefault.length, sqDefault.length) > 80;
          return (
            <div key={key} className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
              <div className="mb-2 flex items-center gap-2">
                <code className="text-[12px] text-muted">{key}</code>
                {edited && <Badge tone="accent">edited</Badge>}
              </div>
              <ActionForm action={saveUiText}>
                <input type="hidden" name="key" value={key} />
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-muted">Turkish{trOver[key] !== undefined && <> · default: “{trDefault}”</>}</span>
                    <textarea name="tr" lang="tr" rows={long ? 3 : 1} defaultValue={trOver[key] ?? trDefault} className={`${textareaClass} min-h-10`} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-muted">Albanian{sqOver[key] !== undefined && <> · default: “{sqDefault}”</>}</span>
                    <textarea name="sq" lang="sq" rows={long ? 3 : 1} defaultValue={sqOver[key] ?? sqDefault} className={`${textareaClass} min-h-10`} />
                  </label>
                </div>
              </ActionForm>
              {edited && (
                <ActionForm action={saveUiText} submitLabel="Reset to default" danger inline className="mt-2">
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="reset" value="1" />
                </ActionForm>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
