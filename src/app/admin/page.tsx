import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/server-env";
import { Card, PageHeader } from "./_ui/ui";

export const metadata = { title: "Overview" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

type Overview = Record<
  "users" | "users_7d" | "premium" | "translations_today" | "ai_spend_today_eur" | "pending_reports" | "fixed_translations" | "phrases" | "words" | "lessons",
  number
>;

export default async function AdminHome() {
  await requireAdmin();
  const { data, error } = await createAdminClient().rpc("admin_overview");
  const o = (data ?? {}) as Partial<Overview>;
  const cap = Number(serverEnv("AI_DAILY_SPEND_CAP_EUR") ?? 5) || 5;

  const stats: { label: string; value: string; href?: string; hint?: string }[] = [
    { label: "Users", value: String(o.users ?? 0), hint: `${o.users_7d ?? 0} new in 7 days`, href: "/admin/users" },
    { label: "Premium now", value: String(o.premium ?? 0), href: "/admin/users?filter=premium" },
    { label: "Translations today", value: String(o.translations_today ?? 0), hint: "Kosovo time" },
    { label: "AI spend today", value: `€${Number(o.ai_spend_today_eur ?? 0).toFixed(3)}`, hint: `Cap €${cap} per day (UTC)` },
    { label: "Reports waiting", value: String(o.pending_reports ?? 0), href: "/admin/reports" },
    { label: "Fixed translations", value: String(o.fixed_translations ?? 0), href: "/admin/translations" },
    { label: "Quick Talk phrases", value: String(o.phrases ?? 0), href: "/admin/quick-talk" },
    { label: "Dictionary words", value: String(o.words ?? 0), href: "/admin/dictionary" },
    { label: "Lessons", value: String(o.lessons ?? 0), href: "/admin/lessons" },
  ];

  return (
    <>
      <PageHeader title="Overview" description="Everything you change here shows on the site right away (on the next page load)." />
      {error && <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-accent-text">Could not load numbers: {error.message}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => {
          const body = (
            <>
              <p className="text-[13px] font-medium text-muted">{s.label}</p>
              <p className="mt-1 text-[28px] font-bold tabular-nums">{s.value}</p>
              {s.hint && <p className="text-[12px] text-muted">{s.hint}</p>}
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline hover:ring-accent-text/40">
              {body}
            </Link>
          ) : (
            <div key={s.label} className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-hairline">
              {body}
            </div>
          );
        })}
      </div>

      {(o.phrases ?? 0) === 0 && (
        <Card title="The database has no content yet" className="mt-6">
          <p className="text-[15px] text-muted">
            The site is showing the built-in starter content. <Link href="/admin/import" className="font-semibold text-accent-text">Import it</Link> to
            make it editable here.
          </p>
        </Card>
      )}
    </>
  );
}
