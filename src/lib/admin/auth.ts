import "server-only";
import { cache } from "react";
import { getUser } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/server-env";

/**
 * Admin access = signed in with a confirmed email that is listed in ADMIN_EMAILS
 * (server-only env var, comma or space separated, case-insensitive), e.g.
 *   ADMIN_EMAILS=you@example.com, partner@example.com
 * Changing it needs a redeploy on Vercel. Empty or missing = nobody is an admin.
 */
export function adminEmails(): Set<string> {
  return new Set(
    (serverEnv("ADMIN_EMAILS") ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim().replace(/^["']|["']$/g, "").toLowerCase())
      .filter(Boolean),
  );
}

export type Admin = { id: string; email: string };

/** The signed-in admin, or null. Cached per request. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const user = await getUser();
  if (!user?.email || !user.email_confirmed_at) return null;
  return adminEmails().has(user.email.toLowerCase()) ? { id: user.id, email: user.email } : null;
});

export class NotAdminError extends Error {
  constructor() {
    super("Admin access required");
  }
}

/** Every admin page and server action starts with this. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) throw new NotAdminError();
  return admin;
}
