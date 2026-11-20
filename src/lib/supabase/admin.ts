import "server-only";
import { createClient } from "@supabase/supabase-js";
import { assertSupabaseEnv, supabaseUrl } from "./env";

/**
 * Service-role client: BYPASSES RLS. Server-only, never imported by client code
 * (the "server-only" import makes that a build error). Use it only for writes that
 * no user is allowed to make directly: consent proof for logged-out visitors,
 * usage counters, translation cache, verified payment webhooks.
 */
export function createAdminClient() {
  assertSupabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SECRET_KEY (server-only). See .env.example.");
  return createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
