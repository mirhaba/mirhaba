import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getTracks } from "@/lib/content/queries";
import { ActionForm } from "../../../_ui/form";
import { Card, PageHeader } from "../../../_ui/ui";
import { deleteTrack, saveTrack } from "../../actions";
import { TrackFields } from "../../fields";

export const metadata = { title: "Track" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function TrackAdmin({ params }: PageProps<"/admin/lessons/track/[slug]">) {
  await requireAdmin();
  const { slug } = await params;
  const tracks = await getTracks();
  const index = tracks.findIndex((t) => t.slug === slug);
  const track = tracks[index];
  if (!track) notFound();

  return (
    <>
      <PageHeader title={track.title.tr} back={{ href: "/admin/lessons", label: "Lessons" }} />
      <div className="flex flex-col gap-6">
        <Card>
          <ActionForm action={saveTrack}>
            <TrackFields track={track} sort={index} />
          </ActionForm>
        </Card>
        <Card title="Delete track" description="Only possible when it has no units.">
          <ActionForm action={deleteTrack} submitLabel="Delete track" danger confirm={`Delete the track "${track.title.tr}"?`}>
            <input type="hidden" name="slug" value={slug} />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
