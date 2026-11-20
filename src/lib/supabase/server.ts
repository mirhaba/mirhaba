import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { sessionCookieWrites } from "./cookies";
import { assertSupabaseEnv, supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Sessions live in httpOnly cookies (never localStorage). Create one per request.
 * Always trust `auth.getUser()` (verified by Supabase), never the raw cookie contents.
 */
export async function createClient() {
  assertSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of sessionCookieWrites(cookiesToSet)) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: the proxy refreshes the session on every request.
        }
      },
    },
  });
}

/** The verified current user, or null. */
export async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}
