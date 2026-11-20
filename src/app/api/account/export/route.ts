import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkLimit } from "@/lib/rate-limit";

/** GDPR right of access: everything we hold about the signed-in user, as a JSON download. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!(await checkLimit("exportUser", auth.user.id))) {
    return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  }

  const { data, error } = await supabase.rpc("export_my_data");
  if (error) return NextResponse.json({ error: "export_failed" }, { status: 500 });

  const body = JSON.stringify(
    { account: { id: auth.user.id, email: auth.user.email, created_at: auth.user.created_at }, ...(data as object) },
    null,
    2,
  );
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="mirhaba-data-${date}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
