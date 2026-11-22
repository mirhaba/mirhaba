import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ access_token: z.string().min(20).max(8192), refresh_token: z.string().min(1).max(1024) });

/**
 * Email sign-in links (implicit flow) deliver the session in the URL fragment, which only the
 * browser can read. AuthLinkHandler posts the tokens here so the session is stored the same way
 * as every other sign-in: in httpOnly cookies set by the server (plus the signed-in hint).
 * setSession() verifies the access token with Supabase before anything is written.
 */
export async function POST(request: NextRequest) {
  // Same-origin only: stops another site from signing a visitor into someone else's account.
  const origin = request.headers.get("origin");
  if (!origin || hostOf(origin) !== request.nextUrl.host) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.setSession(body.data);
  if (error || !data.user) return NextResponse.json({ ok: false }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** "null" (sandboxed iframes, file://) or garbage is not a valid origin: answer 403, never crash with 500. */
function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}
