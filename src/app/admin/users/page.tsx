import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, LinkList, PageHeader, SearchForm } from "../_ui/ui";

export const metadata = { title: "Users & Premium" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

type UserRow = { id: string; email: string; created_at: string; last_sign_in_at: string | null; premium_until: string | null; plan_id: string | null };

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function UsersAdmin({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin();
  const { q = "", filter } = (await searchParams) as { q?: string; filter?: string };
  const { data, error } = await createAdminClient().rpc("admin_find_users", { p_query: q.trim(), p_premium_only: filter === "premium", p_limit: 100 });
  const users = (data ?? []) as UserRow[];

  return (
    <>
      <PageHeader title="Users & Premium" description="Find an account by email, see its plan, give or end Premium." />
      <SearchForm placeholder="Search by email" defaultValue={q}>
        {filter === "premium" && <input type="hidden" name="filter" value="premium" />}
      </SearchForm>
      <div className="mb-3 flex gap-2 text-[14px]">
        <Link href="/admin/users" className={filter !== "premium" ? "font-semibold text-accent-text" : "text-muted"}>
          All
        </Link>
        <Link href="/admin/users?filter=premium" className={filter === "premium" ? "font-semibold text-accent-text" : "text-muted"}>
          Premium only
        </Link>
      </div>
      {error && <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-accent-text">{error.message}</p>}
      <LinkList
        empty="No accounts found."
        items={users.map((u) => ({
          href: `/admin/users/${u.id}`,
          title: u.email,
          subtitle: `Joined ${date(u.created_at)} · last sign-in ${date(u.last_sign_in_at)}`,
          meta: u.premium_until ? <Badge tone="accent">Premium until {date(u.premium_until)}</Badge> : <Badge>Free</Badge>,
        }))}
      />
      <p className="mt-2 text-[13px] text-muted">Showing the newest 100 matches.</p>
    </>
  );
}
