"use server";

import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { adminAction, check, int, jsonList, ok, refreshContent, required, slugOf, str, UserError, type ActionResult } from "@/lib/admin/actions-kit";

// ---------------------------------------------------------------- Tracks (courses)

export async function saveTrack(_: ActionResult, form: FormData): Promise<ActionResult> {
  const original = str(form, "original");
  const slug = original || slugOf(form, "slug");
  return adminAction({ action: original ? "content.track.update" : "content.track.create", target: slug }, async ({ db }) => {
    const icon = str(form, "icon");
    if (!["plane", "map", "message"].includes(icon)) throw new UserError("Pick an icon.");
    const row = {
      title_tr: required(form, "title_tr", "Turkish title", 120),
      title_sq: required(form, "title_sq", "Albanian title", 120),
      description_tr: str(form, "description_tr"),
      description_sq: str(form, "description_sq"),
      icon,
      sort_order: int(form, "sort_order"),
    };
    if (original) check(await db.from("courses").update(row).eq("slug", slug));
    else check(await db.from("courses").insert({ slug, is_free: true, ...row }));
    refreshContent();
    return ok(original ? "Saved" : "Track added");
  });
}

export async function deleteTrack(_: ActionResult, form: FormData): Promise<ActionResult> {
  const slug = str(form, "slug");
  let deleted = false;
  const result = await adminAction({ action: "content.track.delete", target: slug }, async ({ db }) => {
    const row = check(await db.from("courses").select("id, units(count)").eq("slug", slug).single()) as unknown as { id: string; units: { count: number }[] };
    if ((row.units[0]?.count ?? 0) > 0) throw new UserError("Delete its units first.");
    check(await db.from("courses").delete().eq("id", row.id));
    refreshContent();
    deleted = true;
  });
  if (deleted) redirect("/admin/lessons");
  return result;
}

// ---------------------------------------------------------------- Units

export async function saveUnit(_: ActionResult, form: FormData): Promise<ActionResult> {
  const original = str(form, "original");
  const slug = original || slugOf(form, "slug");
  return adminAction({ action: original ? "content.unit.update" : "content.unit.create", target: slug }, async ({ db }) => {
    const course = check(await db.from("courses").select("id").eq("slug", str(form, "track")).single());
    const row = {
      course_id: course.id,
      title_tr: required(form, "title_tr", "Turkish title", 120),
      title_sq: required(form, "title_sq", "Albanian title", 120),
      is_free: form.get("is_free") === "on",
      sort_order: int(form, "sort_order"),
    };
    if (original) check(await db.from("units").update(row).eq("slug", slug));
    else check(await db.from("units").insert({ slug, ...row }));
    refreshContent();
    return ok(original ? "Saved" : "Unit added");
  });
}

export async function deleteUnit(_: ActionResult, form: FormData): Promise<ActionResult> {
  const slug = str(form, "slug");
  let deleted = false;
  const result = await adminAction({ action: "content.unit.delete", target: slug }, async ({ db }) => {
    const row = check(await db.from("units").select("id, lessons(count)").eq("slug", slug).single()) as unknown as { id: string; lessons: { count: number }[] };
    if ((row.lessons[0]?.count ?? 0) > 0) throw new UserError("Delete its lessons first.");
    check(await db.from("units").delete().eq("id", row.id));
    refreshContent();
    deleted = true;
  });
  if (deleted) redirect("/admin/lessons");
  return result;
}

// ---------------------------------------------------------------- Lessons

export async function saveLesson(_: ActionResult, form: FormData): Promise<ActionResult> {
  const original = str(form, "original");
  const slug = original || slugOf(form, "slug");
  let created = false;
  const result = await adminAction({ action: original ? "content.lesson.update" : "content.lesson.create", target: slug }, async ({ db }) => {
    const unit = check(await db.from("units").select("id").eq("slug", str(form, "unit")).single());
    const row = {
      unit_id: unit.id,
      title_tr: required(form, "title_tr", "Turkish title", 120),
      title_sq: required(form, "title_sq", "Albanian title", 120),
      situation: str(form, "situation_tr"),
      situation_sq: str(form, "situation_sq"),
      sort_order: int(form, "sort_order"),
    };

    // Words: blank ids get a new stable id. Ids must stay the same once learners have progress on them.
    const items = jsonList<Record<string, string>>(form, "items")
      .map((i) => ({
        id: (i.id ?? "").trim().toLowerCase() || `${slug}-${randomBytes(3).toString("hex")}`,
        sq: (i.sq ?? "").trim(),
        tr: (i.tr ?? "").trim(),
        note_tr: (i.note_tr ?? "").trim(),
        note_sq: (i.note_sq ?? "").trim(),
      }))
      .filter((i) => i.sq || i.tr);
    if (items.some((i) => !i.sq || !i.tr)) throw new UserError("Every word needs both Albanian and Turkish.");
    if (items.some((i) => !/^[a-z0-9-]{1,80}$/.test(i.id))) throw new UserError("Word ids: a-z, 0-9 and - only.");
    if (new Set(items.map((i) => i.id)).size !== items.length) throw new UserError("Two words have the same id.");
    if (items.length && items.length < 4) throw new UserError("A lesson needs at least 4 words (for the exercises).");

    if (original) check(await db.from("lessons").update(row).eq("slug", slug));
    else check(await db.from("lessons").insert({ slug, ...row }));

    // An id used by another lesson would silently move that word here.
    const clash = check(await db.from("lesson_items").select("id, lessons!inner(slug)").in("id", items.map((i) => i.id)).neq("lessons.slug", slug));
    if (clash.length) throw new UserError(`Word id "${clash[0].id}" is already used in another lesson.`);
    check(await db.rpc("admin_save_lesson_items", { p_lesson_slug: slug, p_items: items }));

    refreshContent();
    created = !original;
    return ok(original ? "Saved" : "Lesson added");
  });
  if (created) redirect(`/admin/lessons/${slug}`);
  return result;
}

export async function deleteLesson(_: ActionResult, form: FormData): Promise<ActionResult> {
  const slug = str(form, "slug");
  let deleted = false;
  const result = await adminAction({ action: "content.lesson.delete", target: slug }, async ({ db }) => {
    check(await db.from("lessons").delete().eq("slug", slug));
    refreshContent();
    deleted = true;
  });
  if (deleted) redirect("/admin/lessons");
  return result;
}
