import { categoryIcons } from "@/components/icons";
import { Field, Grid, inputClass } from "../_ui/ui";

export function CategoryFields({ value }: { value?: { slug: string; tr: string; sq: string; icon: string; basic: boolean; sort: number } }) {
  return (
    <>
      {value && <input type="hidden" name="original" value={value.slug} />}
      <Grid cols={2}>
        <Field label="Turkish name">
          <input name="name_tr" required maxLength={60} defaultValue={value?.tr} className={inputClass} />
        </Field>
        <Field label="Albanian name">
          <input name="name_sq" required maxLength={60} defaultValue={value?.sq} className={inputClass} />
        </Field>
        {!value && (
          <Field label="Slug (for links, can't change later)" hint="a-z, 0-9 and -, e.g. pharmacy">
            <input name="slug" required pattern="[a-z0-9-]{1,80}" className={inputClass} />
          </Field>
        )}
        <Field label="Icon">
          <select name="icon" defaultValue={value?.icon ?? "hand"} className={inputClass}>
            {Object.keys(categoryIcons).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order" hint="Lower comes first">
          <input name="sort_order" type="number" defaultValue={value?.sort ?? 99} className={inputClass} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-[15px]">
          <input type="checkbox" name="basic" defaultChecked={value?.basic ?? true} className="h-5 w-5 accent-[var(--accent)]" />
          Part of the free offline basics
        </label>
      </Grid>
    </>
  );
}
