import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { paymentsConfig } from "@/lib/payments/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "../_ui/form";
import { Badge, Card, inputClass, PageHeader } from "../_ui/ui";
import { recheckPayment, refund } from "./actions";

export const metadata = { title: "Payments" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

type Row = {
  id: string;
  user_id: string | null;
  email: string | null;
  plan_id: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  raiaccept_status: string | null;
  status_code: string | null;
  raiaccept_order_id: string | null;
  reference: string | null;
  is_production: boolean | null;
  created_at: string;
  paid_at: string | null;
  refund_requested_at: string | null;
  premium_revoked_at: string | null;
  checked_at: string | null;
};

const FILTERS = ["all", "succeeded", "pending", "failed", "refunded"] as const;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
const tone = { succeeded: "good", pending: "warn", failed: "neutral", refunded: "accent" } as const;

export default async function PaymentsAdmin({ searchParams }: PageProps<"/admin/payments">) {
  await requireAdmin();
  const { status } = (await searchParams) as { status?: string };
  const filter = FILTERS.includes(status as (typeof FILTERS)[number]) ? (status as (typeof FILTERS)[number]) : "all";
  const config = paymentsConfig();
  const { data, error } = await createAdminClient().rpc("admin_list_payments", { p_status: filter === "all" ? null : filter, p_limit: 100 });
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader
        title="Payments"
        description="Card payments through RaiAccept. Statuses are always confirmed with the RaiAccept API, never taken from the browser or a webhook alone."
      />
      <div className="mb-4 flex flex-col gap-2">
        <p className="text-[14px]">
          Mode: {config.configured ? <Badge tone={config.mode === "production" ? "good" : "warn"}>{config.mode}</Badge> : <Badge>not configured</Badge>}
          {config.configured && config.mode === "sandbox" && (
            <span className="ml-2 text-muted">Test cards only, no real money. On the live site only admins can open the checkout.</span>
          )}
        </p>
        {!config.webhookSecret && config.configured && (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-[14px]">
            RAIACCEPT_WEBHOOK_SECRET is not set, so RaiAccept can&apos;t notify the site. Payments are still confirmed when the buyer returns,
            on their account page, or with &quot;Re-check&quot; here.
          </p>
        )}
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-[14px]">
        {FILTERS.map((f) => (
          <Link key={f} href={f === "all" ? "/admin/payments" : `/admin/payments?status=${f}`} className={filter === f ? "font-semibold text-accent-text" : "text-muted"}>
            {f[0].toUpperCase() + f.slice(1)}
          </Link>
        ))}
      </div>
      {error && <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-accent-text">{error.message}</p>}
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-muted ring-1 ring-hairline">No payments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((p) => (
            <li key={p.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold">
                      {Number(p.amount).toFixed(2)} {p.currency} · {p.plan_id}
                    </p>
                    <p className="truncate text-[14px] text-muted">
                      {p.user_id ? (
                        <Link href={`/admin/users/${p.user_id}`} className="hover:text-foreground">
                          {p.email ?? p.user_id}
                        </Link>
                      ) : (
                        "deleted account"
                      )}{" "}
                      · {when(p.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.is_production === false && <Badge tone="warn">sandbox</Badge>}
                    <Badge tone={tone[p.status]}>{p.status}</Badge>
                  </div>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-[13px] text-muted sm:grid-cols-2">
                  <div>RaiAccept: {p.raiaccept_status ?? "—"}{p.status_code ? ` (code ${p.status_code})` : ""}</div>
                  <div>Paid: {when(p.paid_at)}</div>
                  <div className="break-all">Order: {p.raiaccept_order_id ?? "—"}</div>
                  <div className="break-all">Reference: {p.reference ?? "—"}</div>
                  <div>Last checked: {when(p.checked_at)}</div>
                  {p.refund_requested_at && <div>Refund requested: {when(p.refund_requested_at)}</div>}
                  {p.premium_revoked_at && <div>Premium taken back: {when(p.premium_revoked_at)}</div>}
                </dl>
                <div className="mt-3 flex flex-col gap-3 border-t border-hairline pt-3">
                  {p.raiaccept_order_id && p.status !== "refunded" && (
                    <ActionForm action={recheckPayment} submitLabel="Re-check with RaiAccept" inline>
                      <input type="hidden" name="payment_id" value={p.id} />
                    </ActionForm>
                  )}
                  {p.status === "succeeded" && !p.refund_requested_at && (
                    <details className="text-[14px]">
                      <summary className="cursor-pointer font-medium text-accent-text">Refund…</summary>
                      <div className="mt-3">
                        <ActionForm action={refund} submitLabel="Send full refund" danger confirm={`Refund ${Number(p.amount).toFixed(2)} ${p.currency} to the buyer's card?`}>
                          <input type="hidden" name="payment_id" value={p.id} />
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="revoke" defaultChecked className="h-4 w-4 accent-[var(--accent)]" />
                            Also take back the Premium time this payment bought
                          </label>
                          <label className="flex flex-col gap-1">
                            <span>Type REFUND to confirm</span>
                            <input name="confirm" autoComplete="off" className={`${inputClass} max-w-48`} />
                          </label>
                        </ActionForm>
                      </div>
                    </details>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[13px] text-muted">Showing the newest 100. Refunds can also be issued in the RaiAccept Merchant portal; re-check the payment afterwards.</p>
    </>
  );
}
