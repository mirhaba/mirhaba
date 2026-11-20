"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { hasLocale, type Locale } from "@/i18n/config";
import { findGlossaryMatches } from "@/lib/glossary";
import { FREE_TEXT_TRANSLATIONS_PER_DAY, MAX_TRANSLATION_CHARS, PAID_TEXT_TRANSLATIONS_PER_DAY } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkLimit, checkLimits, clientIp } from "@/lib/rate-limit";
import {
  PROMPT_VERSION,
  translateWithAi,
  TranslationRefused,
  TranslationUnavailable,
} from "@/lib/translate/translator";

export type TranslateError = "auth" | "consent" | "slowDown" | "empty" | "tooLong" | "limit" | "busy" | "refused" | "generic";

export type TranslateResult =
  | {
      ok: true;
      translation: string;
      notes: { term: string; meaning: string }[];
      /** Translations left today; null for paid accounts. */
      remaining: number | null;
    }
  | { ok: false; error: TranslateError; remaining?: number | null };

const inputSchema = z.object({
  lang: z.custom<Locale>((v) => typeof v === "string" && hasLocale(v)),
  text: z.string(),
  direction: z.enum(["tr-sq", "sq-tr"]),
  variant: z.enum(["standard", "kosovan"]),
});

const DAILY_CAP_EUR = Number(process.env.AI_DAILY_SPEND_CAP_EUR ?? 5) || 5;

export async function translateText(raw: z.input<typeof inputSchema>): Promise<TranslateResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "generic" };
  const { lang, direction } = parsed.data;
  const variant = direction === "tr-sq" ? parsed.data.variant : "standard";

  // Collapse whitespace; the text is otherwise sent exactly as typed.
  const text = parsed.data.text.replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, error: "empty" };
  if (text.length > MAX_TRANSLATION_CHARS) return { ok: false, error: "tooLong" };

  // 1) Who is asking? Translation needs an account (free tier is counted per user).
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "auth" };
  const userId = auth.user.id;

  // Terms + 16+ must be accepted before any account feature.
  const { data: profile } = await supabase.from("profiles").select("age_confirmed_at").eq("id", userId).single();
  if (!profile?.age_confirmed_at) return { ok: false, error: "consent" };

  // Bursts (scripts, stuck buttons). Checked before the daily quota so blocked bursts cost nothing.
  if (!(await checkLimits([["translateUser", userId], ["translateIp", await clientIp()]]))) {
    return { ok: false, error: "slowDown" };
  }

  const admin = createAdminClient();

  // 2) Count it against today's quota (atomic, can't be raced past the limit).
  const { data: paid } = await supabase.rpc("has_active_subscription");
  const limit = paid ? PAID_TEXT_TRANSLATIONS_PER_DAY : FREE_TEXT_TRANSLATIONS_PER_DAY;
  const { data: left, error: quotaError } = await admin.rpc("consume_text_translation", { uid: userId, daily_limit: limit });
  if (quotaError) return { ok: false, error: "generic" };
  if (left === -1) return { ok: false, error: "limit", remaining: 0 };
  const remaining = paid ? null : (left as number);
  const refund = () => admin.rpc("refund_text_translation", { uid: userId });

  // 3) Cache: same text, same direction/style/reader language → same answer, no AI call.
  //    Only a hash of the input is stored, never the input itself.
  const hash = createHash("sha256").update([PROMPT_VERSION, direction, variant, lang, text].join("|")).digest("hex");
  const { data: cached } = await admin.from("translation_cache").select("output, hits").eq("hash", hash).maybeSingle();
  if (cached) {
    await admin.from("translation_cache").update({ hits: cached.hits + 1, last_hit_at: new Date().toISOString() }).eq("hash", hash);
    try {
      const output = JSON.parse(cached.output) as { translation: string; notes: { term: string; meaning: string }[] };
      return { ok: true, translation: output.translation, notes: output.notes, remaining };
    } catch {
      // corrupt row: fall through to a fresh translation
    }
  }

  // 4) Global spending cap: an attack (or a bug) can never produce a huge bill.
  const { data: budgetOk } = await admin.rpc("ai_budget_available", { cap_eur: DAILY_CAP_EUR });
  if (!budgetOk) {
    await refund();
    return { ok: false, error: "busy", remaining };
  }

  // 5) Translate by meaning, with the slang glossary for any slang in the text.
  try {
    const result = await translateWithAi({ text, direction, variant, uiLang: lang, glossary: findGlossaryMatches(text) });

    await Promise.all([
      admin.rpc("record_ai_spend", {
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        cost_eur: result.usage.costEur,
      }),
      admin.from("translation_cache").upsert({
        hash,
        source_lang: direction === "tr-sq" ? "tr" : "sq",
        target_dialect: direction === "sq-tr" ? "standard" : variant === "kosovan" ? "gheg" : "standard",
        output: JSON.stringify({ translation: result.translation, notes: result.notes }),
      }),
    ]);

    return { ok: true, translation: result.translation, notes: result.notes, remaining };
  } catch (error) {
    await refund();
    if (error instanceof TranslationRefused) return { ok: false, error: "refused", remaining };
    if (error instanceof TranslationUnavailable) return { ok: false, error: "busy", remaining };
    console.error("translate failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "generic", remaining };
  }
}

const correctionSchema = z.object({
  direction: z.enum(["tr-sq", "sq-tr"]),
  source: z.string().trim().min(1).max(MAX_TRANSLATION_CHARS),
  translation: z.string().trim().min(1).max(4000),
  suggestion: z.string().trim().min(1).max(1000),
});

/** "Wrong translation?" → the moderation queue (`corrections`, status pending). */
export async function submitCorrection(raw: z.input<typeof correctionSchema>): Promise<{ ok: boolean }> {
  const parsed = correctionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  if (!(await checkLimit("correctionUser", auth.user.id))) return { ok: false };

  const { direction, source, translation, suggestion } = parsed.data;
  const { error } = await supabase.from("corrections").insert({
    user_id: auth.user.id,
    free_text: `[${direction}] ${source}\n→ ${translation}`.slice(0, 1000),
    suggestion,
  });
  return { ok: !error };
}
