import { RowsEditor } from "../_ui/form";
import { Field, Grid, inputClass, textareaClass } from "../_ui/ui";

export type FixedTranslation = {
  id: string;
  direction: "tr-sq" | "sq-tr";
  variant: "standard" | "kosovan";
  source_text: string;
  translation: string;
  notes: { term: string; meaning_tr?: string; meaning_sq?: string }[];
  updated_at: string;
};

export function FixedTranslationFields({ value }: { value?: FixedTranslation }) {
  return (
    <>
      {value && <input type="hidden" name="id" value={value.id} />}
      <Grid cols={2}>
        <Field label="Direction">
          <select name="direction" defaultValue={value?.direction ?? "tr-sq"} className={inputClass}>
            <option value="tr-sq">Turkish → Albanian</option>
            <option value="sq-tr">Albanian → Turkish</option>
          </select>
        </Field>
        <Field label="Albanian style (Turkish → Albanian only)">
          <select name="variant" defaultValue={value?.variant ?? "kosovan"} className={inputClass}>
            <option value="kosovan">Kosovan</option>
            <option value="standard">Standard</option>
          </select>
        </Field>
        <Field label="Original text" hint="Matched exactly, ignoring capitals, accents, extra spaces and the final punctuation.">
          <textarea name="source_text" required maxLength={1000} defaultValue={value?.source_text} className={textareaClass} />
        </Field>
        <Field label="Translation to show">
          <textarea name="translation" required maxLength={4000} defaultValue={value?.translation} className={textareaClass} />
        </Field>
      </Grid>
      <Field label="Notes under the translation (optional, max 3)">
        <RowsEditor
          name="notes"
          addLabel="Add note"
          columns={[
            { key: "term", label: "Word" },
            { key: "meaning_tr", label: "Meaning (TR)" },
            { key: "meaning_sq", label: "Meaning (SQ)" },
          ]}
          initial={(value?.notes ?? []).map((n) => ({ term: n.term, meaning_tr: n.meaning_tr ?? "", meaning_sq: n.meaning_sq ?? "" }))}
        />
      </Field>
    </>
  );
}
