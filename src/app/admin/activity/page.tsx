import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "../_ui/ui";

export const metadata = { title: "Activity log" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

export default async function ActivityAdmin() {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db.from("audit_log").select("id, actor, action, target, details, at").order("at", { ascending: false }).limit(300);
  const rows = data ?? [];

  // Who did it: admin actions store the email in details; for others look the account up once.
  const emails = new Map<string, string>();
  for (const id of new Set(rows.filter((r) => r.actor && !(r.details as { by?: string } | null)?.by).map((r) => r.actor as string))) {
    const { data: u } = await db.auth.admin.getUserById(id);
    if (u?.user?.email) emails.set(id, u.user.email);
  }

  return (
    <>
      <PageHeader title="Activity log" description="Every change made in the admin (and every report review). Newest first, last 300." />
      {error && <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-accent-text">{error.message}</p>}
      <div className="overflow-x-auto rounded-2xl bg-surface shadow-card ring-1 ring-hairline">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead className="bg-surface-2 text-[12px] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Who</th>
              <th className="px-3 py-2 font-medium">What</th>
              <th className="px-3 py-2 font-medium">Item</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-hairline">
                <td className="px-3 py-2 whitespace-nowrap text-muted">{new Date(r.at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-3 py-2">{(r.details as { by?: string } | null)?.by ?? (r.actor ? (emails.get(r.actor) ?? "deleted account") : "system")}</td>
                <td className="px-3 py-2 font-medium">{r.action}</td>
                <td className="px-3 py-2 text-muted">{r.target}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted">
                  Nothing yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
