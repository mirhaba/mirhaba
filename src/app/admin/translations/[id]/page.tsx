import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "../../_ui/form";
import { Card, PageHeader } from "../../_ui/ui";
import { deleteFixedTranslation, saveFixedTranslation } from "../actions";
import { FixedTranslationFields, type FixedTranslation } from "../fields";

export const metadata = { title: "Fixed translation" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function FixedTranslationAdmin({ params }: PageProps<"/admin/translations/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data } = await createAdminClient()
    .from("fixed_translations")
    .select("id, direction, variant, source_text, translation, notes, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const row = data as FixedTranslation;

  return (
    <>
      <PageHeader title="Fixed translation" back={{ href: "/admin/translations", label: "Fixed translations" }} />
      <div className="flex flex-col gap-6">
        <Card>
          <ActionForm action={saveFixedTranslation}>
            <FixedTranslationFields value={row} />
          </ActionForm>
        </Card>
        <Card title="Delete">
          <ActionForm action={deleteFixedTranslation} submitLabel="Delete" danger confirm="Delete this fixed translation? The AI will translate this text again.">
            <input type="hidden" name="id" value={id} />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
