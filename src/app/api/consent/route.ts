import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CONSENT_COOKIE, CONSENT_MAX_AGE, COOKIE_POLICY_VERSION, serializeConsent } from "@/lib/consent";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkLimit, clientIp } from "@/lib/rate-limit";

/** Random id for logged-out visitors, so their consent record can be proven later. Not used for tracking. */
const ANON_COOKIE = "MIRHABA_ANON";
const bodySchema = z.object({ analytics: z.boolean() }).strict();

/**
 * Saves a cookie-banner choice: sets the consent cookie and stores proof in `consents`
 * (type cookies_analytics, policy version, granted, timestamp).
 */
export async function POST(request: NextRequest) {
  // CSRF: only our own pages may post here.
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!(await checkLimit("consentIp", await clientIp()))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const choice = parsed.data;

  // Who is this? A signed-in user, otherwise an anonymous id.
  let userId: string | null = null;
  if (request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
    const { data } = await (await createClient()).auth.getUser();
    userId = data.user?.id ?? null;
  }
  const existingAnon = request.cookies.get(ANON_COOKIE)?.value;
  const anonId = existingAnon && z.string().uuid().safeParse(existingAnon).success ? existingAnon : crypto.randomUUID();

  const { error } = await createAdminClient()
    .from("consents")
    .insert({
      user_id: userId,
      anon_id: userId ? null : anonId,
      type: "cookies_analytics",
      version: COOKIE_POLICY_VERSION,
      granted: choice.analytics,
    });
  if (error) console.error("consent insert failed", error.message);

  // Respect the choice even if logging the proof failed; never block the visitor.
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(CONSENT_COOKIE, serializeConsent(choice), {
    path: "/",
    maxAge: CONSENT_MAX_AGE,
    sameSite: "lax",
    secure,
    httpOnly: false, // the page must read it to decide whether analytics may load
  });
  if (!userId) {
    response.cookies.set(ANON_COOKIE, anonId, { path: "/", maxAge: CONSENT_MAX_AGE, sameSite: "lax", secure, httpOnly: true });
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
