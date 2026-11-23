import "server-only";
import type { Locale } from "@/i18n/config";
import type { SlangEntry } from "@/content/slang";
import { serverEnv } from "@/lib/server-env";
import {
  DEFAULT_MODEL,
  glossaryNote,
  runTranslation,
  targetName,
  type AlbanianVariant,
  type Direction,
  type Note,
} from "./engine";

// Prompt, glossary matching and the Groq call live in ./engine.ts (shared with the regression run).
export { PROMPT_VERSION, TranslationRefused, TranslationUnavailable } from "./engine";
export type { AlbanianVariant, Direction } from "./engine";

export type TranslationResult = {
  translation: string;
  notes: Note[];
  usage: { inputTokens: number; outputTokens: number; costEur: number };
};

// Groq's OpenAI-compatible API, serving OpenAI's open-weight gpt-oss-120b.
const MODEL = serverEnv("TRANSLATION_MODEL") || DEFAULT_MODEL;
// Per-million-token prices for the default model on Groq (USD; used as EUR, which slightly over-counts: the safe side).
const PRICE_IN = 0.15;
const PRICE_OUT = 0.6;

function isMock() {
  return process.env.TRANSLATION_MOCK === "1" && process.env.VERCEL_ENV !== "production";
}

export async function translateWithAi(input: {
  text: string;
  direction: Direction;
  variant: AlbanianVariant;
  uiLang: Locale;
  /** Entries matched for this text (`findGlossaryMatches`). Always sent with the request when non-empty. */
  glossary: SlangEntry[];
}): Promise<TranslationResult> {
  if (isMock()) {
    // Local development without an API key: TRANSLATION_MOCK=1. Never active on Vercel production.
    await new Promise((r) => setTimeout(r, 600));
    return {
      translation: `[mock → ${targetName(input.direction, input.variant)}] ${input.text}`,
      notes: input.glossary.slice(0, 3).map((g) => glossaryNote(g, input.uiLang)),
      usage: { inputTokens: 0, outputTokens: 0, costEur: 0 },
    };
  }

  const apiKey = serverEnv("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  // 15 s per attempt, one retry: a person is waiting at a door.
  const result = await runTranslation(input, { apiKey, model: MODEL, timeoutMs: 15_000 });
  return {
    translation: result.translation,
    notes: result.notes,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costEur: (result.inputTokens * PRICE_IN + result.outputTokens * PRICE_OUT) / 1_000_000,
    },
  };
}
