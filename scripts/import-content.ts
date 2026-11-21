// Copies the starter content (src/content/*.ts) into the database: adds what's missing and fills
// empty fields, never overwrites edits made in the admin dashboard. Same as Admin → Import.
//
//   npm run db:import            (local database, reads .env.local)
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.

import { createClient } from "@supabase/supabase-js";
import { importStarterContent } from "../src/lib/content/starter.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (run with --env-file=.env.local).");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const report = await importStarterContent(db);
console.log("Imported:", report);
