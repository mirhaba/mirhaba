"use server";

import { adminAction, check, ok, required, str, UserError, type ActionResult } from "@/lib/admin/actions-kit";

/**
 * Approve or reject a "Wrong translation?" report. When approving, the corrected text can be saved
 * as a fixed translation, so the Translate page answers with it from now on.
 */
export async function reviewReport(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = str(form, "id");
  const decision = str(form, "decision");
  return adminAction({ action: `report.${decision}`, target: id }, async ({ admin, db }) => {
    if (!/^[0-9a-f-]{36}$/.test(id) || !["approved", "rejected", "pending"].includes(decision)) throw new UserError("Unknown report.");

    if (decision === "approved" && form.get("save_fixed") === "on") {
      const direction = str(form, "direction");
      if (!["tr-sq", "sq-tr"].includes(direction)) throw new UserError("Pick a direction for the fixed translation.");
      check(
        await db.from("fixed_translations").upsert(
          {
            direction,
            variant: direction === "sq-tr" ? "standard" : str(form, "variant") === "standard" ? "standard" : "kosovan",
            source_text: required(form, "source", "Original text", 1000),
            translation: required(form, "translation", "Correct translation", 4000),
            created_by: admin.id,
          },
          { onConflict: "direction,variant,source_normalized" },
        ),
      );
    }

    check(
      await db
        .from("corrections")
        .update({ status: decision, reviewed_by: decision === "pending" ? null : admin.id, reviewed_at: decision === "pending" ? null : new Date().toISOString() })
        .eq("id", id),
    );
    return ok(decision === "approved" ? "Approved" : decision === "rejected" ? "Rejected" : "Moved back to waiting");
  });
}
