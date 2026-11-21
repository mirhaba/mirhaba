import type { Track } from "@/lib/content/model";
import { Field, Grid, inputClass, textareaClass } from "../_ui/ui";

export function TrackFields({ track, sort }: { track?: Track; sort: number }) {
  return (
    <>
      {track && <input type="hidden" name="original" value={track.slug} />}
      <Grid cols={2}>
        <Field label="Turkish title">
          <input name="title_tr" required defaultValue={track?.title.tr} className={inputClass} />
        </Field>
        <Field label="Albanian title">
          <input name="title_sq" required defaultValue={track?.title.sq} className={inputClass} />
        </Field>
        <Field label="Description, Turkish">
          <textarea name="description_tr" defaultValue={track?.description.tr} className={textareaClass} />
        </Field>
        <Field label="Description, Albanian">
          <textarea name="description_sq" defaultValue={track?.description.sq} className={textareaClass} />
        </Field>
        {!track && (
          <Field label="Slug (can't change later)" hint="a-z, 0-9, -">
            <input name="slug" required pattern="[a-z0-9-]{1,80}" className={inputClass} />
          </Field>
        )}
        <Field label="Icon">
          <select name="icon" defaultValue={track?.icon ?? "message"} className={inputClass}>
            <option value="plane">plane</option>
            <option value="map">map</option>
            <option value="message">message</option>
          </select>
        </Field>
        <Field label="Order" hint="Lower comes first">
          <input name="sort_order" type="number" defaultValue={sort} className={inputClass} />
        </Field>
      </Grid>
    </>
  );
}

export function UnitFields({
  tracks,
  trackSlug,
  unit,
  sort,
}: {
  tracks: Track[];
  trackSlug: string;
  unit?: Track["units"][number];
  sort: number;
}) {
  return (
    <>
      {unit && <input type="hidden" name="original" value={unit.slug} />}
      <Grid cols={2}>
        <Field label="Turkish title">
          <input name="title_tr" required defaultValue={unit?.title.tr} className={inputClass} />
        </Field>
        <Field label="Albanian title">
          <input name="title_sq" required defaultValue={unit?.title.sq} className={inputClass} />
        </Field>
        {!unit && (
          <Field label="Slug (can't change later)" hint="a-z, 0-9, -">
            <input name="slug" required pattern="[a-z0-9-]{1,80}" className={inputClass} />
          </Field>
        )}
        <Field label="Track">
          <select name="track" defaultValue={trackSlug} className={inputClass}>
            {tracks.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.title.tr}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order" hint="Lower comes first">
          <input name="sort_order" type="number" defaultValue={sort} className={inputClass} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-[15px]">
          <input type="checkbox" name="is_free" defaultChecked={unit?.isFree ?? true} className="h-5 w-5 accent-[var(--accent)]" />
          Free (unticked = Premium only)
        </label>
      </Grid>
    </>
  );
}
