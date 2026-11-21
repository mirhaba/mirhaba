import { requireAdmin } from "@/lib/admin/auth";
import { getQuickTalk } from "@/lib/content/queries";
import { ActionForm } from "../../_ui/form";
import { Card, Field, inputClass, PageHeader } from "../../_ui/ui";
import { deleteReply, saveReply } from "../actions";

export const metadata = { title: "Reply buttons" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function RepliesAdmin() {
  await requireAdmin();
  const { replies } = await getQuickTalk();

  return (
    <>
      <PageHeader
        title="Reply buttons"
        description="Short answers the other person taps on a phrase (shown in Albanian, the user reads the Turkish). Pick them per phrase."
        back={{ href: "/admin/quick-talk", label: "Quick Talk" }}
      />
      <div className="flex flex-col gap-3">
        {Object.values(replies).map((r) => (
          <div key={r.id} className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
            <ActionForm action={saveReply} inline className="flex-1">
              <input type="hidden" name="original" value={r.id} />
              <span className="w-28 text-[13px] text-muted">{r.id}</span>
              <input name="sq" aria-label="Albanian" defaultValue={r.sq} required className={`${inputClass} max-w-48`} />
              <input name="tr" aria-label="Turkish" defaultValue={r.tr} required className={`${inputClass} max-w-48`} />
            </ActionForm>
            <ActionForm action={deleteReply} inline submitLabel="Delete" danger confirm={`Delete the reply "${r.sq}"? It disappears from every phrase.`}>
              <input type="hidden" name="id" value={r.id} />
            </ActionForm>
          </div>
        ))}
        <Card title="New reply button" className="mt-3">
          <ActionForm action={saveReply} submitLabel="Add reply" resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Id" hint="a-z, 0-9, -  e.g. later">
                <input name="id" required pattern="[a-z0-9-]{1,80}" className={inputClass} />
              </Field>
              <Field label="Albanian">
                <input name="sq" required className={inputClass} />
              </Field>
              <Field label="Turkish">
                <input name="tr" required className={inputClass} />
              </Field>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
