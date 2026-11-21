import "server-only";
import { refresh, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONTENT_TAG, UI_TEXT_TAG } from "@/lib/content/queries";
import { requireAdmin, type Admin } from "./auth";

/** What every admin form action returns; shown under the form. */
export type ActionResult = { ok: boolean; message: string } | null;

export const ok = (message = "Saved"): ActionResult => ({ ok: true, message });
export const fail = (message: string): ActionResult => ({ ok: false, message });

/** Thrown inside an action to show a message instead of a generic error. */
export class UserError extends Error {}

/**
 * Runs an admin action: checks ADMIN_EMAILS, gives it a service-role client, turns errors into
 * a message for the form, and writes the audit log entry.
 */
export async function adminAction(
  audit: { action: string; target?: string } | null,
  run: (ctx: { admin: Admin; db: ReturnType<typeof createAdminClient> }) => Promise<ActionResult | void>,
): Promise<ActionResult> {
  let admin: Admin;
  try {
    admin = await requireAdmin();
  } catch {
    return fail("You are not signed in as an admin.");
  }
  const db = createAdminClient();
  try {
    const result = (await run({ admin, db })) ?? ok();
    if (audit && result?.ok) {
      await db.from("audit_log").insert({ actor: admin.id, action: audit.action, target: audit.target ?? null, details: { by: admin.email } });
    }
    // Re-render the admin page so lists show the change (reports, users, fixed translations aren't cached).
    if (result?.ok) refresh();
    return result;
  } catch (error) {
    // redirect() / notFound() inside an action must keep propagating.
    if (error && typeof error === "object" && "digest" in error) throw error;
    if (error instanceof UserError) return fail(error.message);
    console.error("admin action failed", error);
    return fail(error instanceof Error ? error.message : "Something went wrong.");
  }
}

/** Throws a readable error when a Supabase call failed. */
export function check<T>(result: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> {
  if (result.error) {
    if (result.error.code === "23505") throw new UserError("That already exists (the id/slug or text must be unique).");
    throw new UserError(result.error.message);
  }
  return result.data as NonNullable<T>;
}

/** After any content change: the public site shows it on the next request. */
export function refreshContent() {
  updateTag(CONTENT_TAG);
}
export function refreshUiText() {
  updateTag(UI_TEXT_TAG);
}

// ---- Form helpers

export const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
export const optional = (form: FormData, key: string) => str(form, key) || null;
export function required(form: FormData, key: string, label: string, max = 1000) {
  const value = str(form, key);
  if (!value) throw new UserError(`${label} is required.`);
  if (value.length > max) throw new UserError(`${label} is too long (max ${max} characters).`);
  return value;
}
export function slugOf(form: FormData, key: string, label = "Slug") {
  const value = str(form, key).toLowerCase();
  if (!/^[a-z0-9-]{1,80}$/.test(value)) throw new UserError(`${label}: use only a-z, 0-9 and "-" (max 80).`);
  return value;
}
export function jsonList<T>(form: FormData, key: string): T[] {
  try {
    const value = JSON.parse(str(form, key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    throw new UserError("Could not read the list. Reload the page and try again.");
  }
}
export const int = (form: FormData, key: string, fallback = 0) => {
  const n = Number.parseInt(str(form, key), 10);
  return Number.isFinite(n) ? n : fallback;
};
