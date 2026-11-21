import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { contentNotImported } from "@/lib/admin/data";
import { getTracks } from "@/lib/content/queries";
import { ActionForm } from "../_ui/form";
import { Badge, Card, PageHeader } from "../_ui/ui";
import { NotImported } from "../_ui/not-imported";
import { saveTrack, saveUnit } from "./actions";
import { TrackFields, UnitFields } from "./fields";

export const metadata = { title: "Lessons" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function LessonsAdmin() {
  await requireAdmin();
  const [tracks, empty] = await Promise.all([getTracks(), contentNotImported("courses")]);

  return (
    <>
      <PageHeader title="Lessons" description="Tracks → units → lessons → words. Exercises are generated from each lesson's words." />
      {empty && <NotImported />}
      <div className="flex flex-col gap-6">
        {tracks.map((track) => (
          <Card key={track.slug}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[20px] font-semibold">
                {track.title.tr} <span className="text-muted">· {track.title.sq}</span>
              </h2>
              <Link href={`/admin/lessons/track/${track.slug}`} className="text-[14px] font-semibold text-accent-text">
                Edit track
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-4">
              {track.units.map((unit) => (
                <div key={unit.slug}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold">{unit.title.tr}</h3>
                    {unit.isFree ? <Badge tone="good">Free</Badge> : <Badge tone="accent">Premium</Badge>}
                    <Link href={`/admin/lessons/unit/${unit.slug}`} className="text-[13px] font-semibold text-accent-text">
                      Edit unit
                    </Link>
                    <Link href={`/admin/lessons/new?unit=${unit.slug}`} className="text-[13px] font-semibold text-accent-text">
                      + Lesson
                    </Link>
                  </div>
                  <ul className="overflow-hidden rounded-xl ring-1 ring-hairline">
                    {unit.lessons.map((lesson) => (
                      <li key={lesson.slug} className="border-b border-hairline last:border-b-0">
                        <Link href={`/admin/lessons/${lesson.slug}`} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-surface-2">
                          <span>
                            <span className="font-medium">{lesson.title.tr}</span> <span className="text-muted">· {lesson.title.sq}</span>
                          </span>
                          <span className="text-[13px] text-muted">{lesson.items.length} words</span>
                        </Link>
                      </li>
                    ))}
                    {!unit.lessons.length && <li className="px-3 py-2.5 text-[14px] text-muted">No lessons yet.</li>}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        ))}

        <Card title="New unit" description="A group of lessons inside a track. Untick “Free” to make it Premium.">
          {tracks.length ? (
            <ActionForm action={saveUnit} submitLabel="Add unit" resetOnSuccess>
              <UnitFields tracks={tracks} trackSlug={tracks[0].slug} sort={99} />
            </ActionForm>
          ) : (
            <p className="text-muted">Add a track first.</p>
          )}
        </Card>
        <Card title="New track">
          <ActionForm action={saveTrack} submitLabel="Add track" resetOnSuccess>
            <TrackFields sort={tracks.length} />
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
