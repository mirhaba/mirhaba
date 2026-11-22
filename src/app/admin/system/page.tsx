import { connection } from "next/server";
import { Redis } from "@upstash/redis";
import { adminEmails, requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site";
import { Badge, Card, PageHeader } from "../_ui/ui";

export const metadata = { title: "System check" };
// Private dashboard: pages read fresh data on every visit, so navigations may wait for it.
export const instant = false;

type Status = "ok" | "fail" | "missing" | "off";
type Row = { name: string; what: string; status: Status; detail?: string };

const set = (name: string) => !!process.env[name]?.trim();
const TIMEOUT = 5000;

/** Each live check: never shows a value, never costs money. */
async function checkSupabaseSecret(): Promise<[Status, string]> {
  if (!set("SUPABASE_SECRET_KEY")) return ["missing", "Admin pages, translation and Premium need it."];
  try {
    const { error } = await createAdminClient().from("profiles").select("id", { count: "exact", head: true });
    return error ? ["fail", error.message] : ["ok", "Connected with the admin key."];
  } catch (error) {
    return ["fail", error instanceof Error ? error.message : "Could not connect."];
  }
}

async function checkGroq(): Promise<[Status, string]> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return ["missing", "Translation will fail with a generic error."];
  try {
    // Listing models is free; it only proves the key is accepted.
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT),
      cache: "no-store",
    });
    if (res.ok) return ["ok", `Key accepted. Model: ${process.env.TRANSLATION_MODEL || "openai/gpt-oss-120b"}`];
    return ["fail", res.status === 401 ? "Groq rejected the key (401). Check for typos or a revoked key." : `Groq answered ${res.status}.`];
  } catch {
    return ["fail", "Could not reach Groq (timeout or network)."];
  }
}

async function checkUpstash(): Promise<[Status, string]> {
  if (!set("UPSTASH_REDIS_REST_URL") || !set("UPSTASH_REDIS_REST_TOKEN")) {
    return ["missing", "Rate limits (login emails, translation bursts, exports) are OFF in production."];
  }
  try {
    const pong = await Promise.race([Redis.fromEnv().ping(), new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), TIMEOUT))]);
    return pong === "PONG" ? ["ok", "Redis answered."] : ["fail", `Unexpected answer: ${String(pong)}`];
  } catch (error) {
    return ["fail", error instanceof Error ? error.message : "Could not reach Upstash."];
  }
}

async function checkTurnstile(): Promise<[Status, string]> {
  const site = set("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!site && !secret) return ["off", "Optional. No bot check on the login form."];
  if (!site) return ["missing", "TURNSTILE_SECRET_KEY is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is not: the widget won't show."];
  if (!secret) {
    return ["ok", "Site key set. The secret belongs in Supabase (Authentication → Attack Protection), which checks the token."];
  }
  try {
    // A dummy token: Cloudflare says whether the *secret* is valid before judging the token.
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: "system-check" }),
      signal: AbortSignal.timeout(TIMEOUT),
      cache: "no-store",
    });
    const body = (await res.json()) as { "error-codes"?: string[] };
    const codes = body["error-codes"] ?? [];
    if (codes.includes("invalid-input-secret")) return ["fail", "Cloudflare rejected TURNSTILE_SECRET_KEY."];
    return ["ok", "Site key set and the secret is accepted."];
  } catch {
    return ["fail", "Could not reach Cloudflare."];
  }
}

export default async function SystemCheck() {
  await requireAdmin();
  await connection();

  const [supabase, groq, upstash, turnstile] = await Promise.all([checkSupabaseSecret(), checkGroq(), checkUpstash(), checkTurnstile()]);
  const admins = adminEmails().size;

  const groups: { title: string; description: string; rows: Row[] }[] = [
    {
      title: "Required",
      description: "The site doesn't work properly without these.",
      rows: [
        {
          name: "NEXT_PUBLIC_SUPABASE_URL + _PUBLISHABLE_KEY",
          what: "Database and sign-in",
          status: set("NEXT_PUBLIC_SUPABASE_URL") && set("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ? "ok" : "missing",
          detail: "You are signed in, so these work.",
        },
        { name: "SUPABASE_SECRET_KEY", what: "Admin, translation, Premium", status: supabase[0], detail: supabase[1] },
        { name: "GROQ_API_KEY", what: "AI translation", status: groq[0], detail: groq[1] },
        {
          name: "ADMIN_EMAILS",
          what: "Who can open this dashboard",
          status: admins ? "ok" : "missing",
          detail: `${admins} admin ${admins === 1 ? "address" : "addresses"} (you are one of them).`,
        },
        {
          name: "NEXT_PUBLIC_SITE_URL",
          what: "Links in emails, sitemap, sharing",
          status: "ok",
          detail: `In use: ${siteUrl}${set("NEXT_PUBLIC_SITE_URL") ? "" : " (taken from Vercel; set it when you add your own domain)"}`,
        },
      ],
    },
    {
      title: "Strongly recommended",
      description: "Protection against abuse and bills.",
      rows: [
        { name: "UPSTASH_REDIS_REST_URL + _TOKEN", what: "Rate limits", status: upstash[0], detail: upstash[1] },
        {
          name: "AI_DAILY_SPEND_CAP_EUR",
          what: "Daily AI spending cap",
          status: "ok",
          detail: `€${Number(process.env.AI_DAILY_SPEND_CAP_EUR ?? 5) || 5} per day${set("AI_DAILY_SPEND_CAP_EUR") ? "" : " (default)"}.`,
        },
      ],
    },
    {
      title: "Optional",
      description: "Features that stay off until set.",
      rows: [
        { name: "NEXT_PUBLIC_TURNSTILE_SITE_KEY", what: "Bot check on login", status: turnstile[0], detail: turnstile[1] },
        {
          name: "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED",
          what: "\"Continue with Google\" button",
          status: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true" ? "ok" : "off",
          detail: "Also needs Google set up in Supabase (Authentication → Providers).",
        },
        { name: "NEXT_PUBLIC_POSTHOG_KEY", what: "Analytics (after cookie consent)", status: set("NEXT_PUBLIC_POSTHOG_KEY") ? "ok" : "off" },
        { name: "NEXT_PUBLIC_SENTRY_DSN", what: "Error tracking", status: set("NEXT_PUBLIC_SENTRY_DSN") ? "ok" : "off" },
        {
          name: "RAIACCEPT_*",
          what: "Payments (not live yet)",
          status: set("RAIACCEPT_API_URL") ? "ok" : "off",
          detail: "Waiting for the bank. Premium can be granted by hand in Users & Premium.",
        },
      ],
    },
  ];

  return (
    <>
      <PageHeader
        title="System check"
        description="Which settings (Vercel environment variables) are set, with a live test where possible. Values are never shown. Changing a variable needs a redeploy on Vercel."
      />
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <Card key={g.title} title={g.title} description={g.description}>
            <ul className="divide-y divide-hairline">
              {g.rows.map((r) => (
                <li key={r.name} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="w-24 shrink-0">
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">{r.what}</p>
                    <p className="font-mono text-[12px] break-all text-muted">{r.name}</p>
                    {r.detail && <p className="mt-0.5 text-[13px] text-muted">{r.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        <p className="text-[13px] text-muted">
          Not checked here (set in the Supabase dashboard, not Vercel): login email sender (SMTP), email templates, redirect URLs.
        </p>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "ok") return <Badge tone="good">Working</Badge>;
  if (status === "off") return <Badge>Off</Badge>;
  if (status === "missing") return <Badge tone="warn">Missing</Badge>;
  return <Badge tone="accent">Failing</Badge>;
}
