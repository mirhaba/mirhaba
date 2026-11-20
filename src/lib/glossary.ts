import { slang, type SlangEntry } from "@/content/slang";
import { normalizeForSearch } from "./text";

/** Lower-case, accent-folded, punctuation turned into single spaces. */
const toWords = (s: string) =>
  normalizeForSearch(s)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const forms = (values: (string | undefined)[], minLength: number) =>
  values
    .filter((f): f is string => !!f)
    .flatMap((f) => f.split(/[,/]/))
    .map(toWords)
    .filter((f) => f.length >= minLength);

/**
 * Trigger words per entry ("Qysh je?" → "qysh je", "çka" → "cka").
 * The headword and Kosovan forms always trigger; plain standard words only when they are
 * idioms of 5+ characters ("kolay gelsin"), so everyday words like "ne" or "si" don't.
 */
const index = slang.map((entry) => ({
  entry,
  forms: [
    ...new Set([
      ...forms([entry.term.text, entry.sqKosovo], 2),
      ...forms([entry.tr, entry.sqStandard], 5),
    ]),
  ],
}));

/** Glossary entries whose words appear in the text (whole words, accent-insensitive). Max 12. */
export function findGlossaryMatches(text: string): SlangEntry[] {
  const haystack = ` ${toWords(text)} `;
  return index
    .filter(({ forms }) => forms.some((form) => haystack.includes(` ${form} `)))
    .map(({ entry }) => entry)
    .slice(0, 12);
}

/** Compact, model-readable glossary lines for the prompt. */
export function glossaryForPrompt(entries: SlangEntry[]): string {
  return entries
    .map((e) => {
      const sq = [`standard "${e.sqStandard}"`, e.sqKosovo && `Kosovo "${e.sqKosovo}"`].filter(Boolean).join(", ");
      return `- "${e.term.text}" [${e.register}] Turkish: "${e.tr}" | Albanian: ${sq} | meaning: ${e.meaning.tr}`;
    })
    .join("\n");
}

/** Meaning notes for the translation result ("term = meaning"). */
export function glossaryNote(entry: SlangEntry, lang: "tr" | "sq"): { term: string; meaning: string } {
  return { term: entry.term.text, meaning: entry.meaning[lang] };
}
