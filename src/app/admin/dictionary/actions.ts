"use server";

import { redirect } from "next/navigation";
import { slugs } from "@/lib/content/model";
import { adminAction, check, int, ok, optional, refreshContent, required, slugOf, str, UserError, type ActionResult } from "@/lib/admin/actions-kit";

const KINDS = ["kosovan", "regional", "slang", "loanword", "turkish_slang"];
const REGISTERS = ["neutral", "casual", "vulgar"];
const ORIGINS = ["albanian", "turkish", "serbian", "german", "english", "latin"];

export async function saveWord(_: ActionResult, form: FormData): Promise<ActionResult> {
  const original = str(form, "original");
  const slug = original || slugOf(form, "slug", "URL slug");
  let created = false;
  const result = await adminAction({ action: original ? "content.word.update" : "content.word.create", target: slugs.word(slug) }, async ({ db }) => {
    const kind = str(form, "kind");
    const register = str(form, "register");
    const origin = str(form, "origin");
    const termLang = str(form, "term_lang");
    if (!KINDS.includes(kind) || !REGISTERS.includes(register) || (origin && !ORIGINS.includes(origin)) || !["tr", "sq"].includes(termLang)) {
      throw new UserError("Pick a value from each list.");
    }
    if (!original) {
      const exists = check(await db.from("expressions").select("slug").eq("slug", slugs.word(slug)).maybeSingle());
      if (exists) throw new UserError("A word with this URL slug already exists.");
    }
    check(
      await db.rpc("admin_upsert_expression", {
        p_slug: slugs.word(slug),
        p_category: `slang:${kind}`,
        p_tr: required(form, "tr", "Turkish", 200),
        p_sq: required(form, "sq_standard", "Standard Albanian", 200),
        p_sq_kosovo: optional(form, "sq_kosovo"),
        p_tr_dialect: kind === "turkish_slang" ? "turkish_slang" : "standard",
      }),
    );
    check(
      await db
        .from("expressions")
        .update({
          term: required(form, "term", "Headword", 200),
          term_lang: termLang,
          register,
          origin: origin || null,
          notes_tr: required(form, "meaning_tr", "Meaning (Turkish)", 1000),
          notes_sq: required(form, "meaning_sq", "Meaning (Albanian)", 1000),
          example_sq: optional(form, "example_sq"),
          example_tr: optional(form, "example_tr"),
          sources: form.getAll("sources").map(String),
          verified: form.get("verified") === "on",
          sort_order: int(form, "sort_order"),
        })
        .eq("slug", slugs.word(slug)),
    );
    refreshContent();
    created = !original;
    return ok(original ? "Saved" : "Word added");
  });
  if (created) redirect(`/admin/dictionary/${slug}`);
  return result;
}

export async function deleteWord(_: ActionResult, form: FormData): Promise<ActionResult> {
  const slug = str(form, "slug");
  let deleted = false;
  const result = await adminAction({ action: "content.word.delete", target: slugs.word(slug) }, async ({ db }) => {
    check(await db.from("expressions").delete().eq("slug", slugs.word(slug)));
    refreshContent();
    deleted = true;
  });
  if (deleted) redirect("/admin/dictionary");
  return result;
}

export async function saveSource(_: ActionResult, form: FormData): Promise<ActionResult> {
  const original = str(form, "original");
  const id = original || str(form, "id");
  return adminAction({ action: original ? "content.source.update" : "content.source.create", target: id }, async ({ db }) => {
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id)) throw new UserError("Id: letters, numbers, - and _ only.");
    const url = str(form, "url");
    if (url && !url.startsWith("https://")) throw new UserError("The link must start with https://");
    const row = { label: required(form, "label", "Label", 300), url: url || null, sort_order: int(form, "sort_order", 99) };
    if (original) check(await db.from("content_sources").update(row).eq("id", id));
    else check(await db.from("content_sources").insert({ id, ...row }));
    refreshContent();
    return ok(original ? "Saved" : "Source added");
  });
}

export async function deleteSource(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = str(form, "id");
  return adminAction({ action: "content.source.delete", target: id }, async ({ db }) => {
    const used = check(await db.from("expressions").select("slug").contains("sources", [id]).limit(1));
    if (used.length) throw new UserError("Some words still use this source. Remove it from them first.");
    check(await db.from("content_sources").delete().eq("id", id));
    refreshContent();
    return ok("Deleted");
  });
}
