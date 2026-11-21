import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** True when the content tables are still empty (the site is showing the built-in starter content). */
export async function contentNotImported(table: "phrase_categories" | "courses" | "expressions"): Promise<boolean> {
  const query = createAdminClient().from(table).select("*", { count: "exact", head: true });
  const { count } = table === "expressions" ? await query.like("category", "slang:%") : await query;
  return !count;
}
