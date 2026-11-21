import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { categories as starterCategories, replies as starterReplies } from "@/content/quick-talk";
import { slang as starterSlang, type Kind, type Origin, type Register } from "@/content/slang";
import { sources as starterSources } from "@/content/sources";
import { tracks as starterTracks } from "@/content/lessons";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";
import { slugs, type Category, type QuickTalkContent, type SlangEntry, type Sources, type Track } from "./model";

/**
 * Everything the public site shows (Quick Talk, dictionary, lessons) is read here, from the
 * database, and cached until an admin saves a change (`updateTag(CONTENT_TAG)` in the admin
 * actions). Pages stay prerendered and fast; edits show up on the next request.
 *
 * If the database is unreachable or still empty (before "Import starter content"), the
 * bundled starter content from src/content is used, cached only briefly.
 */
export const CONTENT_TAG = "content";

type VariantRow = { lang: "tr" | "sq"; dialect: string; text: string; audio_path?: string | null };

function publicDb() {
  // No cookies: content is public (RLS "public read"), and cached scopes can't read cookies anyway.
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const text = (variants: VariantRow[] | null | undefined, lang: "tr" | "sq", dialects = ["standard"]) =>
  variants?.find((v) => v.lang === lang && dialects.includes(v.dialect));

// ---------------------------------------------------------------- Quick Talk

export async function getQuickTalk(): Promise<QuickTalkContent> {
  "use cache";
  cacheTag(CONTENT_TAG);
  try {
    const db = publicDb();
    const [cats, reps] = await Promise.all([
      db
        .from("phrase_categories")
        .select(
          "slug, name_tr, name_sq, icon, basic_pack, sort_order, phrases(slug, slots, sort_order, expressions(variants(lang, dialect, text, audio_path)), reply_buttons(sort_order, expressions(slug)))",
        )
        .order("sort_order"),
      db.from("expressions").select("slug, variants(lang, dialect, text)").eq("category", "reply"),
    ]);
    if (cats.error || reps.error) throw cats.error ?? reps.error;
    if (!cats.data.length) {
      cacheLife("minutes");
      return { categories: starterCategories, replies: starterReplies };
    }

    const replies: QuickTalkContent["replies"] = {};
    for (const row of reps.data as { slug: string; variants: VariantRow[] }[]) {
      const id = slugs.replyId(row.slug);
      replies[id] = { id, tr: text(row.variants, "tr")?.text ?? "", sq: text(row.variants, "sq")?.text ?? "" };
    }

    type PhraseRow = {
      slug: string;
      slots: { tr: string; sq: string }[] | null;
      sort_order: number;
      expressions: { variants: VariantRow[] } | null;
      reply_buttons: { sort_order: number; expressions: { slug: string } | null }[];
    };
    const categories: Category[] = (cats.data as unknown as (Record<string, unknown> & { phrases: PhraseRow[] })[]).map((c) => ({
      slug: c.slug as string,
      name: { tr: c.name_tr as string, sq: c.name_sq as string },
      icon: c.icon as string,
      basic: c.basic_pack as boolean,
      phrases: [...c.phrases]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => {
          const sq = text(p.expressions?.variants, "sq");
          const replyIds = [...p.reply_buttons]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((r) => (r.expressions ? slugs.replyId(r.expressions.slug) : ""))
            .filter((id) => id && replies[id]);
          return {
            id: slugs.phraseId(p.slug),
            tr: text(p.expressions?.variants, "tr")?.text ?? "",
            sq: sq?.text ?? "",
            ...(p.slots?.length ? { slot: p.slots } : {}),
            ...(replyIds.length ? { replies: replyIds } : {}),
            ...(sq?.audio_path ? { audio: sq.audio_path } : {}),
          };
        }),
    }));
    cacheLife("max");
    return { categories, replies };
  } catch (error) {
    console.error("content: Quick Talk from database failed, using starter content", error);
    cacheLife("minutes");
    return { categories: starterCategories, replies: starterReplies };
  }
}

// ---------------------------------------------------------------- Dictionary

export async function getDictionaryEntries(): Promise<SlangEntry[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  try {
    const { data, error } = await publicDb()
      .from("expressions")
      .select(
        "slug, category, register, notes_tr, notes_sq, term, term_lang, origin, example_tr, example_sq, sources, verified, sort_order, variants(lang, dialect, text)",
      )
      .like("category", "slang:%")
      .order("sort_order")
      .order("slug");
    if (error) throw error;
    if (!data.length) {
      cacheLife("minutes");
      return starterSlang;
    }
    const entries = (data as unknown as (Record<string, string | null> & { variants: VariantRow[]; sources: string[]; verified: boolean })[]).map(
      (row): SlangEntry => {
        const tr = text(row.variants, "tr", ["standard", "turkish_slang"])?.text ?? "";
        const sqStandard = text(row.variants, "sq")?.text ?? "";
        const sqKosovo = text(row.variants, "sq", ["gheg"])?.text;
        const termLang = (row.term_lang as "tr" | "sq" | null) ?? "sq";
        return {
          slug: slugs.wordSlug(row.slug as string),
          kind: (row.category as string).replace("slang:", "") as Kind,
          term: { text: row.term || (termLang === "tr" ? tr : (sqKosovo ?? sqStandard)), lang: termLang },
          register: (row.register as Register) ?? "neutral",
          ...(row.origin ? { origin: row.origin as Origin } : {}),
          tr,
          sqStandard,
          ...(sqKosovo ? { sqKosovo } : {}),
          meaning: { tr: row.notes_tr ?? "", sq: row.notes_sq ?? "" },
          ...(row.example_sq || row.example_tr ? { example: { sq: row.example_sq ?? "", tr: row.example_tr ?? "" } } : {}),
          sources: row.sources ?? [],
          verified: row.verified,
        };
      },
    );
    cacheLife("max");
    return entries;
  } catch (error) {
    console.error("content: dictionary from database failed, using starter content", error);
    cacheLife("minutes");
    return starterSlang;
  }
}

export async function getSources(): Promise<Sources> {
  "use cache";
  cacheTag(CONTENT_TAG);
  try {
    const { data, error } = await publicDb().from("content_sources").select("id, label, url").order("sort_order");
    if (error) throw error;
    if (!data.length) {
      cacheLife("minutes");
      return starterSources;
    }
    cacheLife("max");
    return Object.fromEntries(data.map((s) => [s.id, { label: s.label, ...(s.url ? { url: s.url } : {}) }]));
  } catch (error) {
    console.error("content: sources from database failed, using starter content", error);
    cacheLife("minutes");
    return starterSources;
  }
}

// ---------------------------------------------------------------- Lessons

export async function getTracks(): Promise<Track[]> {
  "use cache";
  cacheTag(CONTENT_TAG);
  try {
    const { data, error } = await publicDb()
      .from("courses")
      .select(
        "slug, title_tr, title_sq, description_tr, description_sq, icon, sort_order, units(slug, title_tr, title_sq, is_free, sort_order, lessons(slug, title_tr, title_sq, situation, situation_sq, sort_order, lesson_items(id, sq, tr, note_tr, note_sq, sort_order)))",
      )
      .order("sort_order");
    if (error) throw error;
    if (!data.length) {
      cacheLife("minutes");
      return starterTracks;
    }
    const bySort = <T extends { sort_order: number }>(rows: T[]) => [...rows].sort((a, b) => a.sort_order - b.sort_order);
    type Row = Record<string, unknown> & { sort_order: number };
    const tracks: Track[] = bySort(data as unknown as Row[]).map((c) => ({
      slug: c.slug as string,
      title: { tr: c.title_tr as string, sq: c.title_sq as string },
      description: { tr: c.description_tr as string, sq: c.description_sq as string },
      icon: c.icon as Track["icon"],
      units: bySort(c.units as Row[]).map((u) => ({
        slug: u.slug as string,
        title: { tr: u.title_tr as string, sq: u.title_sq as string },
        isFree: u.is_free as boolean,
        lessons: bySort(u.lessons as Row[]).map((l) => ({
          slug: l.slug as string,
          title: { tr: l.title_tr as string, sq: l.title_sq as string },
          situation: { tr: (l.situation as string) ?? "", sq: l.situation_sq as string },
          items: bySort(l.lesson_items as Row[]).map((i) => ({
            id: i.id as string,
            sq: i.sq as string,
            tr: i.tr as string,
            ...(i.note_tr || i.note_sq ? { note: { tr: (i.note_tr as string) ?? "", sq: (i.note_sq as string) ?? "" } } : {}),
          })),
        })),
      })),
    }));
    cacheLife("max");
    return tracks;
  } catch (error) {
    console.error("content: lessons from database failed, using starter content", error);
    cacheLife("minutes");
    return starterTracks;
  }
}

// ---------------------------------------------------------------- UI text overrides

export const UI_TEXT_TAG = "ui-text";

/** Admin overrides for messages/<locale>.json, as { "dotted.key": "value" }. */
export async function getUiTextOverrides(locale: "tr" | "sq"): Promise<Record<string, string>> {
  "use cache";
  cacheTag(UI_TEXT_TAG);
  try {
    const { data, error } = await publicDb().from("ui_texts").select("key, value").eq("locale", locale);
    if (error) throw error;
    cacheLife("max");
    return Object.fromEntries(data.map((r) => [r.key, r.value]));
  } catch (error) {
    console.error("content: UI text overrides failed, using defaults", error);
    cacheLife("minutes");
    return {};
  }
}
