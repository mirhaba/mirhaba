import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getQuickTalk } from "@/lib/content/queries";
import { ActionForm, RowsEditor } from "../../../_ui/form";
import { Card, Field, Grid, inputClass, PageHeader, textareaClass } from "../../../_ui/ui";
import { deletePhrase, savePhrase } from "../../actions";

export const metadata = { title: "Phrase" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function PhraseAdmin({ params }: PageProps<"/admin/quick-talk/[category]/[phrase]">) {
  await requireAdmin();
  const { category: slug, phrase: id } = await params;
  const { categories, replies } = await getQuickTalk();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  const isNew = id === "new";
  const index = category.phrases.findIndex((p) => p.id === id);
  const phrase = isNew ? null : category.phrases[index];
  if (!isNew && !phrase) notFound();

  return (
    <>
      <PageHeader
        title={isNew ? "New phrase" : phrase!.tr}
        description={isNew ? undefined : phrase!.sq}
        back={{ href: `/admin/quick-talk/${slug}`, label: category.name.tr }}
      />
      <div className="flex flex-col gap-6">
        <Card>
          <ActionForm action={savePhrase} submitLabel={isNew ? "Add phrase" : "Save"}>
            {!isNew && <input type="hidden" name="original" value={id} />}
            <input type="hidden" name="original_category" value={slug} />
            <Grid cols={2}>
              <Field label="Turkish (what the user means)">
                <textarea name="tr" required maxLength={500} defaultValue={phrase?.tr} className={textareaClass} />
              </Field>
              <Field label="Albanian (shown big to the other person)">
                <textarea name="sq" required maxLength={500} defaultValue={phrase?.sq} lang="sq" className={textareaClass} />
              </Field>
              <Field label="Category">
                <select name="category" defaultValue={slug} className={inputClass}>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name.tr} · {c.name.sq}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Order" hint="Lower comes first">
                <input name="sort_order" type="number" defaultValue={isNew ? category.phrases.length : index} className={inputClass} />
              </Field>
              <Field label="Recorded audio (optional)" hint="Path in /public (e.g. /audio/g1.mp3) or an https:// link. Without it, the phone reads it aloud.">
                <input name="audio" defaultValue={phrase?.audio} className={inputClass} />
              </Field>
            </Grid>

            <Field label="Fill-in options (optional)" hint='Put "{slot}" in both texts where the option goes, e.g. "Kat {slot}" / "Kati {slot}".'>
              <RowsEditor
                name="slots"
                addLabel="Add option"
                columns={[
                  { key: "tr", label: "Turkish", placeholder: "3" },
                  { key: "sq", label: "Albanian", placeholder: "3" },
                ]}
                initial={(phrase?.slot ?? []).map((s) => ({ tr: s.tr, sq: s.sq }))}
              />
            </Field>

            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-muted">Reply buttons the other person can tap</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.values(replies).map((r) => (
                  <label key={r.id} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[15px]">
                    <input type="checkbox" name="replies" value={r.id} defaultChecked={phrase?.replies?.includes(r.id)} className="h-4 w-4 accent-[var(--accent)]" />
                    <span>
                      {r.sq} <span className="text-muted">· {r.tr}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </ActionForm>
        </Card>

        {!isNew && (
          <Card title="Delete phrase" description="Also removes it from everyone's favourites.">
            <ActionForm action={deletePhrase} submitLabel="Delete phrase" danger confirm="Delete this phrase?">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="category" value={slug} />
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
