"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
});

/**
 * Approve or reject a correction. The role is checked by RLS ("corrections: moderators
 * review" policy, is_moderator() from the profiles table), never trusted from the browser.
 * The audit_log row is written by a database trigger.
 */
export async function reviewCorrection(raw: z.input<typeof schema>): Promise<{ ok: boolean }> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  const { data, error } = await supabase
    .from("corrections")
    .update({ status: parsed.data.status, reviewed_by: auth.user.id, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("id");

  // No row back = not a moderator (RLS hid it) or the id doesn't exist.
  return { ok: !error && (data?.length ?? 0) === 1 };
}
