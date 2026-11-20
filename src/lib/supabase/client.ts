"use client";

import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseEnv, supabasePublishableKey, supabaseUrl } from "./env";

/** Browser client. Only used to start Google sign-in; everything else goes through the server. */
export function createClient() {
  assertSupabaseEnv();
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
