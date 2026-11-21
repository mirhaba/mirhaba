import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getTracks } from "@/lib/content/queries";
import { ActionForm } from "../../../_ui/form";
import { Card, PageHeader } from "../../../_ui/ui";
import { deleteUnit, saveUnit } from "../../actions";
import { UnitFields } from "../../fields";

export const metadata = { title: "Unit" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function UnitAdmin({ params }: PageProps<"/admin/lessons/unit/[slug]">) {
  await requireAdmin();
  const { slug } = await params;
  const tracks = await getTracks();
  const track = tracks.find((t) => t.units.some((u) => u.slug === slug));
  const index = track?.units.findIndex((u) => u.slug === slug) ?? -1;
  const unit = track?.units[index];
  if (!track || !unit) notFound();

  return (
    <>
      <PageHeader title={unit.title.tr} description={`${track.title.tr} · ${unit.isFree ? "Free" : "Premium"}`} back={{ href: "/admin/lessons", label: "Lessons" }} />
      <div className="flex flex-col gap-6">
        <Card>
          <ActionForm action={saveUnit}>
            <UnitFields tracks={tracks} trackSlug={track.slug} unit={unit} sort={index} />
          </ActionForm>
        </Card>
        <Card title="Delete unit" description="Only possible when it has no lessons.">
          <ActionForm action={deleteUnit} submitLabel="Delete unit" danger confirm={`Delete the unit "${unit.title.tr}"?`}>
            <input type="hidden" name="slug" value={slug} />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
