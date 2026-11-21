import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "../../_ui/form";
import { Badge, Card, Field, Grid, inputClass, PageHeader } from "../../_ui/ui";
import { endPremium, grantPremium } from "../actions";

export const metadata = { title: "User" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default async function UserAdmin({ params }: PageProps<"/admin/users/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = createAdminClient();
  const [{ data: auth }, { data: subs }, { data: profile }, { data: usage }] = await Promise.all([
    db.auth.admin.getUserById(id),
    db.from("subscriptions").select("id, plan_id, status, current_period_end, provider_ref, created_at").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("profiles").select("ui_lang, role, marketing_opt_in, age_confirmed_at").eq("id", id).maybeSingle(),
    db.from("usage_counters").select("day, text_translations").eq("user_id", id).order("day", { ascending: false }).limit(7),
  ]);
  const user = auth?.user;
  if (!user) notFound();
  const active = activeSubscription(subs ?? []);

  return (
    <>
      <PageHeader title={user.email ?? id} back={{ href: "/admin/users", label: "Users" }} />
      <div className="flex flex-col gap-6">
        <Card title="Account">
          <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
            <Info label="Plan">{active ? <Badge tone="accent">Premium until {date(active.current_period_end)}</Badge> : <Badge>Free</Badge>}</Info>
            <Info label="Joined">{date(user.created_at)}</Info>
            <Info label="Last sign-in">{date(user.last_sign_in_at)}</Info>
            <Info label="Interface language">{profile?.ui_lang ?? "—"}</Info>
            <Info label="Consent given">{date(profile?.age_confirmed_at)}</Info>
            <Info label="Marketing emails">{profile?.marketing_opt_in ? "Yes" : "No"}</Info>
            <Info label="Translations (last 7 days)">
              {(usage ?? []).map((u) => `${u.day.slice(5)}: ${u.text_translations}`).join(" · ") || "none"}
            </Info>
          </dl>
        </Card>

        <Card title="Give Premium" description="Adds one billing period (or a number of free days). If Premium is active, it's added on top.">
          <ActionForm action={grantPremium} submitLabel="Give Premium">
            <input type="hidden" name="user_id" value={id} />
            <Grid cols={3}>
              <Field label="Plan">
                <select name="plan" defaultValue="monthly" className={inputClass}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </Field>
              <Field label="Length">
                <select name="length" defaultValue="period" className={inputClass}>
                  <option value="period">One billing period</option>
                  <option value="days">Number of days →</option>
                </select>
              </Field>
              <Field label="Days (if chosen)">
                <input name="days" type="number" min={1} max={3660} defaultValue={30} className={inputClass} />
              </Field>
            </Grid>
          </ActionForm>
        </Card>

        {active && (
          <Card title="End Premium now">
            <ActionForm action={endPremium} submitLabel="End Premium" danger confirm="End this account's Premium right now?">
              <input type="hidden" name="user_id" value={id} />
            </ActionForm>
          </Card>
        )}

        <Card title="Subscription history">
          {(subs ?? []).length ? (
            <ul className="space-y-1 text-[14px]">
              {(subs ?? []).map((s) => (
                <li key={s.id}>
                  {s.plan_id} · <b>{s.status}</b> · ends {date(s.current_period_end)} {s.provider_ref && <span className="text-muted">· {s.provider_ref}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Never had Premium.</p>
          )}
        </Card>
      </div>
    </>
  );
}

/** The subscription that is active right now, if any (same rule as has_active_subscription). */
function activeSubscription<T extends { status: string; current_period_end: string }>(subs: T[]): T | undefined {
  const now = Date.now();
  return subs.find((s) => s.status === "active" && new Date(s.current_period_end).getTime() > now);
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
