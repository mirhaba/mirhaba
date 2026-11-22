import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/server-env";
import { getDefaultDictionary } from "@/i18n/dictionaries";

// Sends the daily reminders that are due (see SQL due_reminders): called every 15 minutes by
// .github/workflows/reminders.yml (or any scheduler) with `Authorization: Bearer $CRON_SECRET`.

type Due = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  ui_lang: "tr" | "sq";
  course: "sq" | "tr";
  streak: number;
  streak_at_risk: boolean;
  local_day: string;
};

function authorized(request: Request): boolean {
  const secret = serverEnv("CRON_SECRET");
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = serverEnv("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return Response.json({ error: "push not configured" }, { status: 503 });
  webpush.setVapidDetails(serverEnv("VAPID_SUBJECT") ?? "mailto:hello@mirhaba.app", publicKey, privateKey);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("due_reminders", { max_rows: 500 });
  if (error) return Response.json({ error: "query failed" }, { status: 500 });
  const due = (data ?? []) as Due[];

  const texts = { tr: (await getDefaultDictionary("tr")).reminders, sq: (await getDefaultDictionary("sq")).reminders };
  const sent: { id: string; local_day: string }[] = [];
  const gone: string[] = [];
  let failed = 0;

  // Small batches: friendly to the push services and to the function's time limit.
  for (let i = 0; i < due.length; i += 25) {
    await Promise.all(
      due.slice(i, i + 25).map(async (r) => {
        const t = texts[r.ui_lang] ?? texts.tr;
        const title = r.streak_at_risk ? t.streakTitle.replace("{n}", String(r.streak)) : r.course === "tr" ? t.dailyTitleTr : t.dailyTitleSq;
        const body = r.streak_at_risk ? t.streakBody : t.dailyBody;
        const payload = JSON.stringify({ title, body, url: `/${r.ui_lang}/learn`, tag: "daily-reminder" });
        try {
          await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payload, {
            TTL: 60 * 60 * 6, // a phone that's off for the evening gets it within 6 hours, or not at all
            urgency: "normal",
          });
          sent.push({ id: r.id, local_day: r.local_day });
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(r.id); // unsubscribed / expired
          else failed++;
        }
      }),
    );
  }

  if (sent.length || gone.length) {
    const { error: markError } = await admin.rpc("mark_reminders_sent", { sent, gone });
    if (markError) return Response.json({ error: "mark failed", sent: sent.length }, { status: 500 });
  }
  return Response.json({ due: due.length, sent: sent.length, removed: gone.length, failed });
}
