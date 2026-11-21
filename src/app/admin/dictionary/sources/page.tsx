import { requireAdmin } from "@/lib/admin/auth";
import { getSources } from "@/lib/content/queries";
import { ActionForm } from "../../_ui/form";
import { Card, Field, inputClass, PageHeader } from "../../_ui/ui";
import { deleteSource, saveSource } from "../actions";

export const metadata = { title: "Sources" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function SourcesAdmin() {
  await requireAdmin();
  const sources = Object.entries(await getSources());

  return (
    <>
      <PageHeader title="Sources" description="Where dictionary entries come from. Shown on every word page." back={{ href: "/admin/dictionary", label: "Dictionary" }} />
      <div className="flex flex-col gap-3">
        {sources.map(([id, s], i) => (
          <Card key={id}>
            <ActionForm action={saveSource}>
              <input type="hidden" name="original" value={id} />
              <input type="hidden" name="sort_order" value={i} />
              <p className="text-[13px] text-muted">{id}</p>
              <Field label="Label">
                <input name="label" required defaultValue={s.label} className={inputClass} />
              </Field>
              <Field label="Link (optional)">
                <input name="url" type="url" defaultValue={s.url} className={inputClass} />
              </Field>
            </ActionForm>
            <ActionForm action={deleteSource} submitLabel="Delete" danger confirm="Delete this source?" className="mt-3">
              <input type="hidden" name="id" value={id} />
            </ActionForm>
          </Card>
        ))}
        <Card title="New source">
          <ActionForm action={saveSource} submitLabel="Add source" resetOnSuccess>
            <Field label="Id" hint="letters, numbers, - and _">
              <input name="id" required pattern="[a-zA-Z0-9_-]{1,40}" className={inputClass} />
            </Field>
            <Field label="Label">
              <input name="label" required className={inputClass} />
            </Field>
            <Field label="Link (optional)">
              <input name="url" type="url" className={inputClass} />
            </Field>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
