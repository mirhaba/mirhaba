import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "../_ui/form";
import { Badge, Field, Grid, inputClass, PageHeader, textareaClass } from "../_ui/ui";
import { reviewReport } from "./actions";

export const metadata = { title: "Reports" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

const STATUSES = ["pending", "approved", "rejected"] as const;

type ReportRow = {
  id: string;
  free_text: string | null;
  direction: string | null;
  variant: string | null;
  source_text: string | null;
  output_text: string | null;
  suggestion: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
};

/** Reports keep source, output and fix in their own columns; very old ones only have "[tr-sq] source\n→ translation". */
function parse(r: ReportRow) {
  if (r.source_text) {
    return {
      direction: (r.direction === "sq-tr" ? "sq-tr" : "tr-sq") as "tr-sq" | "sq-tr",
      variant: r.variant === "standard" ? "standard" : "kosovan",
      source: r.source_text,
      translation: r.output_text ?? "",
    };
  }
  const m = /^\[(tr-sq|sq-tr)\] ([\s\S]*?)\n→ ([\s\S]*)$/.exec(r.free_text ?? "");
  return m
    ? { direction: m[1] as "tr-sq" | "sq-tr", variant: "kosovan", source: m[2], translation: m[3] }
    : { direction: "tr-sq" as const, variant: "kosovan", source: r.free_text ?? "", translation: "" };
}

/** New dictionary word, pre-filled from a report (Admin → Dictionary → New word reads these). */
function glossaryLink(p: ReturnType<typeof parse>, suggestion: string) {
  const params = new URLSearchParams(
    p.direction === "tr-sq"
      ? { term_lang: "tr", tr: p.source, sq_standard: suggestion, report_output: p.translation }
      : { term_lang: "sq", sq_standard: p.source, tr: suggestion, report_output: p.translation },
  );
  return `/admin/dictionary/new?${params}`;
}

export default async function ReportsAdmin({ searchParams }: PageProps<"/admin/reports">) {
  await requireAdmin();
  const { status: statusParam } = (await searchParams) as { status?: string };
  const status = STATUSES.find((s) => s === statusParam) ?? "pending";
  const { data, error } = await createAdminClient()
    .from("corrections")
    .select("id, free_text, direction, variant, source_text, output_text, suggestion, status, created_at, reviewed_at")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(100);

  return (
    <>
      <PageHeader
        title="Wrong-translation reports"
        description="Sent with “Wrong translation?” on the Translate page. Approve to save the better translation as a fixed translation; when one word was wrong, add it to the glossary so every translation gets it right."
      />
      <nav className="mb-4 flex gap-2" aria-label="Status">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/reports?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-[14px] font-medium capitalize ${s === status ? "bg-accent text-on-accent" : "bg-surface-2 text-muted"}`}
          >
            {s}
          </Link>
        ))}
      </nav>
      {error && <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-accent-text">{error.message}</p>}
      {!data?.length && <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-muted">Nothing here.</p>}
      <div className="flex flex-col gap-4">
        {((data ?? []) as ReportRow[]).map((r) => {
          const p = parse(r);
          return (
            <div key={r.id} className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                <Badge>{p.direction === "tr-sq" ? "TR → SQ" : "SQ → TR"}</Badge>
                {p.direction === "tr-sq" && <Badge>{p.variant === "standard" ? "Standard" : "Kosovan"}</Badge>}
                {new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </div>
              <dl className="mb-4 grid gap-3 text-[15px] md:grid-cols-3">
                <div>
                  <dt className="text-[12px] font-medium text-muted">Original</dt>
                  <dd>{p.source}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-medium text-muted">App translated</dt>
                  <dd className="text-muted line-through decoration-accent-text/50">{p.translation}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-medium text-muted">User suggests</dt>
                  <dd className="font-semibold">{r.suggestion}</dd>
                </div>
              </dl>

              {status === "pending" ? (
                <div className="flex flex-col gap-3">
                  <ActionForm action={reviewReport} submitLabel="Approve">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <input type="hidden" name="direction" value={p.direction} />
                    <label className="flex items-center gap-2 text-[15px]">
                      <input type="checkbox" name="save_fixed" defaultChecked className="h-5 w-5 accent-[var(--accent)]" />
                      Also save as a fixed translation
                    </label>
                    <Grid cols={2}>
                      <Field label="Original text">
                        <textarea name="source" defaultValue={p.source} className={textareaClass} />
                      </Field>
                      <Field label="Correct translation (edit if needed)">
                        <textarea name="translation" defaultValue={r.suggestion} className={textareaClass} />
                      </Field>
                    </Grid>
                    {p.direction === "tr-sq" && (
                      <Field label="Albanian style">
                        <select name="variant" defaultValue={p.variant} className={`${inputClass} max-w-xs`}>
                          <option value="kosovan">Kosovan</option>
                          <option value="standard">Standard</option>
                        </select>
                      </Field>
                    )}
                  </ActionForm>
                  <Link href={glossaryLink(p, r.suggestion)} className="self-start text-[14px] font-medium text-accent-text">
                    Add a word from this report to the glossary →
                  </Link>
                  <ActionForm action={reviewReport} submitLabel="Reject" danger inline>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="decision" value="rejected" />
                  </ActionForm>
                </div>
              ) : (
                <ActionForm action={reviewReport} submitLabel="Move back to waiting" danger inline>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="decision" value="pending" />
                </ActionForm>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
