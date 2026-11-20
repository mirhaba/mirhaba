import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type Entitlement = {
  signedIn: boolean;
  /** Has an active subscription whose period hasn't ended. Same rule as SQL `has_active_subscription()`. */
  premium: boolean;
  /** ISO date the current Premium period ends, or null. */
  activeUntil: string | null;
};

const NONE: Entitlement = { signedIn: false, premium: false, activeUntil: null };

/**
 * Who is asking and are they Premium? The one place server code decides this.
 * Cached per request, so pages, layouts and actions can all call it.
 * Payments only ever change the `subscriptions` table (via SQL `activate_subscription`);
 * everything that unlocks Premium reads it through here.
 */
export const getEntitlement = cache(async (): Promise<Entitlement> => {
  // Request time only: the session check and "is the period over?" both compare against now.
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NONE;

  // RLS: users can only read their own subscriptions.
  const { data } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("status", "active")
    .gt("current_period_end", new Date().toISOString())
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { signedIn: true, premium: !!data, activeUntil: data?.current_period_end ?? null };
});
