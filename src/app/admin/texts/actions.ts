"use server";

import { getDefaultDictionary } from "@/i18n/dictionaries";
import { flattenTexts, type Json } from "@/i18n/text-keys";
import { adminAction, check, ok, refreshUiText, str, UserError, type ActionResult } from "@/lib/admin/actions-kit";

const placeholders = (s: string) => (s.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort().join(" ");

/**
 * Saves one UI text in both languages. A value equal to the default removes the override,
 * an empty value is refused (use "Reset" to go back to the default).
 */
export async function saveUiText(_: ActionResult, form: FormData): Promise<ActionResult> {
  const key = str(form, "key");
  return adminAction({ action: "content.ui_text.update", target: key }, async ({ admin, db }) => {
    const reset = form.get("reset") === "1";
    for (const locale of ["tr", "sq"] as const) {
      const defaults = new Map(flattenTexts((await getDefaultDictionary(locale)) as unknown as Json));
      const fallback = defaults.get(key);
      if (fallback === undefined) throw new UserError("Unknown text key.");
      const value = reset ? fallback : String(form.get(locale) ?? "");
      if (!value.trim()) throw new UserError(`The ${locale === "tr" ? "Turkish" : "Albanian"} text can't be empty.`);
      if (value.length > 4000) throw new UserError("Too long (max 4000 characters).");
      if (placeholders(value) !== placeholders(fallback)) {
        throw new UserError(`Keep the placeholders exactly as in the original: ${placeholders(fallback) || "(none)"}`);
      }
      if (value === fallback) check(await db.from("ui_texts").delete().eq("locale", locale).eq("key", key));
      else check(await db.from("ui_texts").upsert({ locale, key, value, updated_by: admin.id }));
    }
    refreshUiText();
    return ok(reset ? "Back to default" : "Saved");
  });
}
