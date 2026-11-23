import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getDictionaryEntries, getSources } from "@/lib/content/queries";
import { dictionaryPath } from "@/lib/site";
import { ActionForm } from "../../_ui/form";
import { Card, Field, Grid, inputClass, PageHeader, textareaClass } from "../../_ui/ui";
import { deleteWord, saveWord } from "../actions";

export const metadata = { title: "Word" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

/** Pre-fill for a new word, e.g. from a "Wrong translation?" report (Admin → Reports). */
type Prefill = { term_lang?: string; tr?: string; sq_standard?: string; report_output?: string };
const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 1000) : undefined);

export default async function WordAdmin({ params, searchParams }: PageProps<"/admin/dictionary/[slug]">) {
  await requireAdmin();
  const { slug } = await params;
  const query = (await searchParams) as Record<string, unknown>;
  const prefill: Prefill = slug === "new"
    ? { term_lang: one(query.term_lang), tr: one(query.tr), sq_standard: one(query.sq_standard), report_output: one(query.report_output) }
    : {};
  const [entries, sources] = await Promise.all([getDictionaryEntries(), getSources()]);
  const isNew = slug === "new";
  const index = entries.findIndex((e) => e.slug === slug);
  const e = isNew ? null : entries[index];
  if (!isNew && !e) notFound();

  return (
    <>
      <PageHeader
        title={isNew ? "New word" : e!.term.text}
        back={{ href: "/admin/dictionary", label: "Dictionary" }}
        actions={
          !isNew && (
            <Link href={dictionaryPath("tr", slug)} target="_blank" className="text-[14px] font-medium text-accent-text">
              Open on site ↗
            </Link>
          )
        }
      />
      <div className="flex flex-col gap-6">
        {isNew && (prefill.tr || prefill.sq_standard) && (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-[14px]">
            Pre-filled from a wrong-translation report: the whole sentence and the user&apos;s fix. Shorten both to the
            word or idiom itself before saving.
            {prefill.report_output && (
              <>
                {" "}
                The app had written: <span className="text-muted line-through">{prefill.report_output}</span>
              </>
            )}
          </p>
        )}
        <Card>
          <ActionForm action={saveWord} submitLabel={isNew ? "Add word" : "Save"}>
            {!isNew && <input type="hidden" name="original" value={slug} />}
            <Grid cols={3}>
              <Field label="Headword (the word the page is about)">
                <input name="term" required defaultValue={e?.term.text ?? (prefill.term_lang === "sq" ? prefill.sq_standard : prefill.tr)} className={inputClass} />
              </Field>
              <Field label="Headword language">
                <select name="term_lang" defaultValue={e?.term.lang ?? (prefill.term_lang === "tr" ? "tr" : "sq")} className={inputClass}>
                  <option value="sq">Albanian</option>
                  <option value="tr">Turkish</option>
                </select>
              </Field>
              {isNew ? (
                <Field label="URL slug" hint="a-z, 0-9, -  → /tr/argo/<slug>">
                  <input name="slug" required pattern="[a-z0-9-]{1,80}" className={inputClass} />
                </Field>
              ) : (
                <Field label="URL slug">
                  <input value={slug} disabled className={`${inputClass} opacity-60`} />
                </Field>
              )}
              <Field label="Kind">
                <select name="kind" defaultValue={e?.kind ?? (prefill.term_lang === "tr" ? "turkish_slang" : "kosovan")} className={inputClass}>
                  <option value="kosovan">Kosovo dialect form (qysh, çka, bon…)</option>
                  <option value="regional">Regional word used in Kosovo (kerr, gepek…)</option>
                  <option value="slang">Slang (quzë, nub…)</option>
                  <option value="loanword">Turkish loanword used in Kosovo</option>
                  <option value="turkish_slang">Turkish slang → Kosovan</option>
                </select>
              </Field>
              <Field label="Tone">
                <select name="register" defaultValue={e?.register ?? "neutral"} className={inputClass}>
                  <option value="neutral">Neutral</option>
                  <option value="casual">Casual</option>
                  <option value="vulgar">Vulgar</option>
                </select>
              </Field>
              <Field label="Origin (optional)">
                <select name="origin" defaultValue={e?.origin ?? ""} className={inputClass}>
                  <option value="">—</option>
                  {["albanian", "turkish", "serbian", "german", "english", "latin"].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Turkish">
                <input name="tr" required defaultValue={e?.tr ?? prefill.tr} className={inputClass} />
              </Field>
              <Field label="Standard Albanian">
                <input name="sq_standard" required defaultValue={e?.sqStandard ?? prefill.sq_standard} className={inputClass} />
              </Field>
              <Field label="How it's said in Kosovo (if different)">
                <input name="sq_kosovo" defaultValue={e?.sqKosovo} className={inputClass} />
              </Field>
            </Grid>
            <Grid cols={2}>
              <Field label="Meaning, in Turkish">
                <textarea name="meaning_tr" required defaultValue={e?.meaning.tr} className={textareaClass} />
              </Field>
              <Field label="Meaning, in Albanian">
                <textarea name="meaning_sq" required defaultValue={e?.meaning.sq} className={textareaClass} />
              </Field>
              <Field label="Example sentence, Albanian (optional)">
                <input name="example_sq" defaultValue={e?.example?.sq} className={inputClass} />
              </Field>
              <Field label="Example sentence, Turkish (optional)">
                <input name="example_tr" defaultValue={e?.example?.tr} className={inputClass} />
              </Field>
            </Grid>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-muted">Sources</legend>
              <div className="flex flex-col gap-2">
                {Object.entries(sources).map(([id, s]) => (
                  <label key={id} className="flex items-start gap-2 text-[14px]">
                    <input type="checkbox" name="sources" value={id} defaultChecked={e?.sources.includes(id)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
                    {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Grid cols={2}>
              <label className="flex items-center gap-2 text-[15px]">
                <input type="checkbox" name="verified" defaultChecked={e?.verified} className="h-5 w-5 accent-[var(--accent)]" />
                Checked by a native Prishtina speaker
              </label>
              <Field label="Order" hint="Lower comes first in the list">
                <input name="sort_order" type="number" defaultValue={isNew ? entries.length : index} className={inputClass} />
              </Field>
            </Grid>
          </ActionForm>
        </Card>
        {!isNew && (
          <Card title="Delete word" description="Removes its page from the site and from the translator's glossary.">
            <ActionForm action={deleteWord} submitLabel="Delete word" danger confirm={`Delete "${e!.term.text}"?`}>
              <input type="hidden" name="slug" value={slug} />
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
