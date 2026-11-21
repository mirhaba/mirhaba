import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { contentNotImported } from "@/lib/admin/data";
import { getDictionaryEntries } from "@/lib/content/queries";
import { normalizeForSearch } from "@/lib/text";
import { Badge, LinkList, PageHeader, SearchForm } from "../_ui/ui";
import { NotImported } from "../_ui/not-imported";

export const metadata = { title: "Dictionary" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

const KIND_LABEL = { kosovan: "Kosovan", loanword: "Turkish loanword", turkish_slang: "Turkish slang" } as const;

export default async function DictionaryAdmin({ searchParams }: PageProps<"/admin/dictionary">) {
  await requireAdmin();
  const { q = "", kind = "" } = (await searchParams) as { q?: string; kind?: string };
  const [entries, empty] = await Promise.all([getDictionaryEntries(), contentNotImported("expressions")]);
  const needle = normalizeForSearch(q);
  const shown = entries.filter(
    (e) =>
      (!kind || e.kind === kind) &&
      (!needle || normalizeForSearch(`${e.slug} ${e.term.text} ${e.tr} ${e.sqStandard} ${e.sqKosovo ?? ""}`).includes(needle)),
  );

  return (
    <>
      <PageHeader
        title="Dictionary"
        description="Slang and Kosovan words (/tr/argo, /sq/zhargon). They also guide the AI translator as a glossary."
        actions={
          <div className="flex gap-2">
            <Link href="/admin/dictionary/sources" className="inline-flex h-10 items-center rounded-full px-4 text-[15px] font-semibold ring-1 ring-hairline hover:bg-surface-2">
              Sources
            </Link>
            <Link href="/admin/dictionary/new" className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-[15px] font-semibold text-on-accent">
              Add word
            </Link>
          </div>
        }
      />
      {empty && <NotImported />}
      <SearchForm placeholder="Search words" defaultValue={q}>
        <select name="kind" defaultValue={kind} aria-label="Kind" className="h-10 rounded-xl bg-surface-2 px-3 text-[15px]">
          <option value="">All kinds</option>
          {Object.entries(KIND_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </SearchForm>
      <p className="mb-2 text-[13px] text-muted">
        {shown.length} of {entries.length} words
      </p>
      <LinkList
        empty="No words match."
        items={shown.map((e) => ({
          href: `/admin/dictionary/${e.slug}`,
          title: e.term.text,
          subtitle: `${e.tr} · ${e.sqKosovo ?? e.sqStandard}`,
          meta: (
            <span className="flex gap-1">
              <Badge>{KIND_LABEL[e.kind]}</Badge>
              {e.verified ? <Badge tone="good">checked</Badge> : <Badge tone="warn">not checked</Badge>}
            </span>
          ),
        }))}
      />
    </>
  );
}
