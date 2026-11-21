"use server";

import { importStarterContent } from "@/lib/content/starter";
import { adminAction, ok, refreshContent, type ActionResult } from "@/lib/admin/actions-kit";

export async function importStarter(): Promise<ActionResult> {
  return adminAction({ action: "content.import_starter" }, async ({ db }) => {
    const r = await importStarterContent(db);
    refreshContent();
    const added = Object.entries(r)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${n} ${k}`)
      .join(", ");
    return ok(added ? `Imported: ${added}` : "Nothing to import, everything is already there.");
  });
}
