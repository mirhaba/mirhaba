import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getTracks } from "@/lib/content/queries";
import { ActionForm, RowsEditor } from "../../_ui/form";
import { Card, Field, Grid, inputClass, PageHeader } from "../../_ui/ui";
import { deleteLesson, saveLesson } from "../actions";

export const metadata = { title: "Lesson" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function LessonAdmin({ params, searchParams }: PageProps<"/admin/lessons/[lesson]">) {
  await requireAdmin();
  const { lesson: slug } = await params;
  const { unit: unitParam } = (await searchParams) as { unit?: string };
  const tracks = await getTracks();
  const units = tracks.flatMap((t) => t.units.map((u) => ({ ...u, track: t })));
  const isNew = slug === "new";
  const unit = isNew ? (units.find((u) => u.slug === unitParam) ?? units[0]) : units.find((u) => u.lessons.some((l) => l.slug === slug));
  const index = unit?.lessons.findIndex((l) => l.slug === slug) ?? -1;
  const lesson = isNew ? null : unit?.lessons[index];
  if (!unit || (!isNew && !lesson)) notFound();

  return (
    <>
      <PageHeader
        title={isNew ? "New lesson" : lesson!.title.tr}
        description={`${unit.track.title.tr} → ${unit.title.tr}${unit.isFree ? "" : " (Premium)"}`}
        back={{ href: "/admin/lessons", label: "Lessons" }}
        actions={
          !isNew && (
            <Link href={`/tr/learn/${slug}`} target="_blank" className="text-[14px] font-medium text-accent-text">
              Try it on the site ↗
            </Link>
          )
        }
      />
      <div className="flex flex-col gap-6">
        <Card>
          <ActionForm action={saveLesson} submitLabel={isNew ? "Add lesson" : "Save"}>
            {!isNew && <input type="hidden" name="original" value={slug} />}
            <Grid cols={2}>
              <Field label="Turkish title">
                <input name="title_tr" required defaultValue={lesson?.title.tr} className={inputClass} />
              </Field>
              <Field label="Albanian title">
                <input name="title_sq" required defaultValue={lesson?.title.sq} className={inputClass} />
              </Field>
              <Field label="Situation, Turkish" hint="The real-life moment it's for, e.g. “At the pharmacy”">
                <input name="situation_tr" defaultValue={lesson?.situation.tr} className={inputClass} />
              </Field>
              <Field label="Situation, Albanian">
                <input name="situation_sq" defaultValue={lesson?.situation.sq} className={inputClass} />
              </Field>
              {isNew && (
                <Field label="Slug (can't change later)" hint="a-z, 0-9, -  → /tr/learn/<slug>">
                  <input name="slug" required pattern="[a-z0-9-]{1,80}" className={inputClass} />
                </Field>
              )}
              <Field label="Unit">
                <select name="unit" defaultValue={unit.slug} className={inputClass}>
                  {units.map((u) => (
                    <option key={u.slug} value={u.slug}>
                      {u.track.title.tr} → {u.title.tr}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Order" hint="Lower comes first">
                <input name="sort_order" type="number" defaultValue={isNew ? unit.lessons.length : index} className={inputClass} />
              </Field>
            </Grid>
            <Field label="Words and phrases (at least 4)" hint="Leave the id empty for new words; it's created when you save. Don't change ids of existing words (learners' progress uses them).">
              <RowsEditor
                name="items"
                addLabel="Add word"
                columns={[
                  { key: "id", label: "Id", placeholder: "auto", width: "130px" },
                  { key: "sq", label: "Albanian", required: true },
                  { key: "tr", label: "Turkish", required: true },
                  { key: "note_tr", label: "Hint (TR, optional)" },
                  { key: "note_sq", label: "Hint (SQ, optional)" },
                ]}
                initial={(lesson?.items ?? []).map((i) => ({ id: i.id, sq: i.sq, tr: i.tr, note_tr: i.note?.tr ?? "", note_sq: i.note?.sq ?? "" }))}
              />
            </Field>
          </ActionForm>
        </Card>
        {!isNew && (
          <Card title="Delete lesson" description="Learners' scores for this lesson are deleted too.">
            <ActionForm action={deleteLesson} submitLabel="Delete lesson" danger confirm={`Delete "${lesson!.title.tr}"? This can't be undone.`}>
              <input type="hidden" name="slug" value={slug} />
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
