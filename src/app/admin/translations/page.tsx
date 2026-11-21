import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "../_ui/form";
import { Badge, Card, LinkList, PageHeader, SearchForm } from "../_ui/ui";
import { saveFixedTranslation } from "./actions";
import { FixedTranslationFields, type FixedTranslation } from "./fields";

export const metadata = { title: "Fixed translations" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function TranslationsAdmin({ searchParams }: PageProps<"/admin/translations">) {
  await requireAdmin();
  const { q = "", added } = (await searchParams) as { q?: string; added?: string };
  let query = createAdminClient()
    .from("fixed_translations")
    .select("id, direction, variant, source_text, translation, notes, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (q.trim()) query = query.or(`source_text.ilike.%${q.replace(/[%,()]/g, " ").trim()}%,translation.ilike.%${q.replace(/[%,()]/g, " ").trim()}%`);
  const { data, error } = await query;
  const rows = (data ?? []) as FixedTranslation[];

  return (
    <>
      <PageHeader
        title="Fixed translations"
        description="Your own answers for exact texts. The Translate page returns these instead of asking the AI (free, instant, always the same). Approving a “Wrong translation?” report can add one too."
      />
      {added && <p className="mb-4 rounded-xl bg-emerald-500/15 px-4 py-3 text-emerald-800 dark:text-emerald-200">Added.</p>}
      {error && <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-accent-text">{error.message}</p>}
      <div className="flex flex-col gap-6">
        <Card title="New fixed translation">
          <ActionForm action={saveFixedTranslation} submitLabel="Add">
            <FixedTranslationFields />
          </ActionForm>
        </Card>
        <div>
          <SearchForm placeholder="Search texts" defaultValue={q} />
          <LinkList
            empty={q ? "Nothing matches." : "No fixed translations yet."}
            items={rows.map((r) => ({
              href: `/admin/translations/${r.id}`,
              title: r.source_text,
              subtitle: `→ ${r.translation}`,
              meta: <Badge>{r.direction === "tr-sq" ? `TR → SQ · ${r.variant}` : "SQ → TR"}</Badge>,
            }))}
          />
        </div>
      </div>
    </>
  );
}
