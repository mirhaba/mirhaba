"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { categoryIcons } from "@/components/icons";
import { slugs } from "@/lib/content/model";
import {
  adminAction,
  check,
  int,
  jsonList,
  ok,
  refreshContent,
  required,
  slugOf,
  str,
  UserError,
  type ActionResult,
} from "@/lib/admin/actions-kit";

// ---------------------------------------------------------------- Categories

export async function saveCategory(_: ActionResult, form: FormData): Promise<ActionResult> {
  const isNew = !str(form, "original");
  const slug = isNew ? slugOf(form, "slug") : str(form, "original");
  let created = false;
  const result = await adminAction({ action: isNew ? "content.category.create" : "content.category.update", target: slug }, async ({ db }) => {
    const icon = str(form, "icon");
    if (!categoryIcons[icon]) throw new UserError("Pick an icon from the list.");
    const row = {
      name_tr: required(form, "name_tr", "Turkish name", 60),
      name_sq: required(form, "name_sq", "Albanian name", 60),
      icon,
      basic_pack: form.get("basic") === "on",
      sort_order: int(form, "sort_order"),
    };
    if (isNew) {
      check(await db.from("phrase_categories").insert({ slug, ...row }));
      created = true;
    } else {
      check(await db.from("phrase_categories").update(row).eq("slug", slug));
    }
    refreshContent();
    return ok(isNew ? "Category created" : "Saved");
  });
  if (created) redirect(`/admin/quick-talk/${slug}`);
  return result;
}

export async function deleteCategory(_: ActionResult, form: FormData): Promise<ActionResult> {
  const slug = str(form, "slug");
  let deleted = false;
  const result = await adminAction({ action: "content.category.delete", target: slug }, async ({ db }) => {
    const cat = check(await db.from("phrase_categories").select("id, phrases(count)").eq("slug", slug).single()) as unknown as {
      id: string;
      phrases: { count: number }[];
    };
    if ((cat.phrases[0]?.count ?? 0) > 0) throw new UserError("Delete or move its phrases first.");
    check(await db.from("phrase_categories").delete().eq("id", cat.id));
    refreshContent();
    deleted = true;
  });
  if (deleted) redirect("/admin/quick-talk");
  return result;
}

// ---------------------------------------------------------------- Phrases

export async function savePhrase(_: ActionResult, form: FormData): Promise<ActionResult> {
  const original = str(form, "original"); // phrase id, empty for a new one
  const id = original || `p${randomBytes(4).toString("hex")}`;
  const category = str(form, "category");
  let createdIn = "";
  const result = await adminAction({ action: original ? "content.phrase.update" : "content.phrase.create", target: slugs.phrase(id) }, async ({ db }) => {
    const tr = required(form, "tr", "Turkish text", 500);
    const sq = required(form, "sq", "Albanian text", 500);
    const slots = jsonList<{ tr?: string; sq?: string }>(form, "slots")
      .map((s) => ({ tr: (s.tr ?? "").trim(), sq: (s.sq ?? "").trim() }))
      .filter((s) => s.tr || s.sq);
    if (slots.some((s) => !s.tr || !s.sq)) throw new UserError("Every fill-in option needs both Turkish and Albanian.");
    if (slots.length && (!tr.includes("{slot}") || !sq.includes("{slot}"))) {
      throw new UserError('With fill-in options, both texts must contain "{slot}" where the option goes.');
    }
    const audio = str(form, "audio");
    if (audio && !/^(\/|https:\/\/)/.test(audio)) throw new UserError("Audio must be a path like /audio/g1.mp3 or an https:// link.");

    check(
      await db.rpc("admin_save_phrase", {
        p_slug: slugs.phrase(id),
        p_category_slug: category,
        p_tr: tr,
        p_sq: sq,
        p_slots: slots.length ? slots : null,
        p_reply_slugs: form.getAll("replies").map((r) => slugs.reply(String(r))),
        p_audio: audio || null,
        p_sort_order: int(form, "sort_order"),
      }),
    );
    refreshContent();
    // New phrase, or moved to another category: go to the list it's in now.
    if (!original || category !== str(form, "original_category")) createdIn = category;
    return ok(original ? "Saved" : "Phrase added");
  });
  if (createdIn) redirect(`/admin/quick-talk/${createdIn}`);
  return result;
}

export async function deletePhrase(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = str(form, "id");
  const category = str(form, "category");
  let deleted = false;
  const result = await adminAction({ action: "content.phrase.delete", target: slugs.phrase(id) }, async ({ db }) => {
    // Removes it from everyone's synced favourites too (cascade).
    check(await db.from("phrases").delete().eq("slug", slugs.phrase(id)));
    check(await db.from("expressions").delete().eq("slug", slugs.phrase(id)));
    refreshContent();
    deleted = true;
  });
  if (deleted) redirect(`/admin/quick-talk/${category}`);
  return result;
}

// ---------------------------------------------------------------- Reply buttons

export async function saveReply(_: ActionResult, form: FormData): Promise<ActionResult> {
  const original = str(form, "original");
  const id = original || slugOf(form, "id", "Id");
  return adminAction({ action: original ? "content.reply.update" : "content.reply.create", target: slugs.reply(id) }, async ({ db }) => {
    if (!original) {
      const exists = check(await db.from("expressions").select("slug").eq("slug", slugs.reply(id)).maybeSingle());
      if (exists) throw new UserError("A reply with this id already exists.");
    }
    check(
      await db.rpc("admin_upsert_expression", {
        p_slug: slugs.reply(id),
        p_category: "reply",
        p_tr: required(form, "tr", "Turkish", 120),
        p_sq: required(form, "sq", "Albanian", 120),
      }),
    );
    refreshContent();
    return ok(original ? "Saved" : "Reply added");
  });
}

export async function deleteReply(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = str(form, "id");
  return adminAction({ action: "content.reply.delete", target: slugs.reply(id) }, async ({ db }) => {
    const expr = check(await db.from("expressions").select("id").eq("slug", slugs.reply(id)).single());
    check(await db.from("reply_buttons").delete().eq("expression_id", expr.id));
    check(await db.from("expressions").delete().eq("id", expr.id));
    refreshContent();
    return ok("Deleted");
  });
}
