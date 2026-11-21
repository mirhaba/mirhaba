"use server";

import { redirect } from "next/navigation";
import { adminAction, check, jsonList, ok, required, str, UserError, type ActionResult } from "@/lib/admin/actions-kit";

/** Fixed translations are read per request by the Translate action, so no cache refresh is needed. */
export async function saveFixedTranslation(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = str(form, "id");
  let created = "";
  const result = await adminAction({ action: id ? "translation.fixed.update" : "translation.fixed.create", target: id || undefined }, async ({ admin, db }) => {
    const direction = str(form, "direction");
    if (!["tr-sq", "sq-tr"].includes(direction)) throw new UserError("Pick a direction.");
    const variant = direction === "sq-tr" ? "standard" : str(form, "variant") === "kosovan" ? "kosovan" : "standard";
    const notes = jsonList<Record<string, string>>(form, "notes")
      .map((n) => ({ term: (n.term ?? "").trim(), meaning_tr: (n.meaning_tr ?? "").trim(), meaning_sq: (n.meaning_sq ?? "").trim() }))
      .filter((n) => n.term);
    if (notes.length > 3) throw new UserError("At most 3 notes.");
    const row = {
      direction,
      variant,
      source_text: required(form, "source_text", "Original text", 1000),
      translation: required(form, "translation", "Translation", 4000),
      notes,
    };
    if (id) {
      check(await db.from("fixed_translations").update(row).eq("id", id));
    } else {
      const inserted = check(await db.from("fixed_translations").insert({ ...row, created_by: admin.id }).select("id").single());
      created = inserted.id;
    }
    return ok(id ? "Saved" : "Added");
  });
  if (created) redirect(`/admin/translations?added=1`);
  return result;
}

export async function deleteFixedTranslation(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = str(form, "id");
  let deleted = false;
  const result = await adminAction({ action: "translation.fixed.delete", target: id }, async ({ db }) => {
    check(await db.from("fixed_translations").delete().eq("id", id));
    deleted = true;
  });
  if (deleted) redirect("/admin/translations");
  return result;
}
