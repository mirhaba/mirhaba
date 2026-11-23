// Scoring for the translation regression set (evals/translation/cases.json).
// Pure functions: used by scripts/translation-eval.ts and by the dataset self-test (npm test).

import { normalizeForSearch } from "../../src/lib/text.ts";
import type { AlbanianVariant, Direction } from "../../src/lib/translate/engine.ts";

export type EvalCase = {
  id: string;
  direction: Direction;
  /** Albanian style for tr-sq; sq-tr cases use "standard". */
  variant: AlbanianVariant;
  source: string;
  /** A good translation (one of many). Scored by similarity (chrF), never required verbatim. */
  expected: string;
  /** Every item must appear in the output (accent-insensitive). "a|b" means either. */
  mustInclude?: string[];
  /** None may appear in the output (accent-insensitive, as a word or word start). */
  mustNotInclude?: string[];
  /** Source words that may legitimately appear in the output (names, shared loanwords). */
  allowCopy?: string[];
  tags?: string[];
};

export type CheckFailure = { check: "mustInclude" | "mustNotInclude" | "copiedWord"; detail: string };

const fold = (s: string) =>
  normalizeForSearch(s)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const words = (s: string) => fold(s).split(" ").filter(Boolean);

/**
 * Words shared by Turkish and Albanian (internationalisms and old loans): never a copying mistake.
 * Compared as word starts after accent folding.
 */
export const SHARED_WORDS = [
  "euro", "taksi", "telefon", "market", "doktor", "polis", "banka", "internet", "hotel", "restoran",
  "otobus", "autobus", "trafik", "depozit", "fatur", "kafe", "minut", "problem", "termin", "apartament",
  "kosov", "turq", "prisht", "prist", "merak", "kusur",
];

function longestCommonPrefix(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Proper names: capitalised words that do not start the sentence ("Priştine'de", "Kosova'da"). */
function properNames(source: string): Set<string> {
  const names = new Set<string>();
  const tokens = source.split(/\s+/);
  tokens.forEach((token, i) => {
    const startsSentence = i === 0 || /[.!?]$/.test(tokens[i - 1]);
    if (!startsSentence && /^\p{Lu}/u.test(token)) words(token).forEach((w) => names.add(w));
  });
  return names;
}

/**
 * Source words that reappear in the output unchanged or with a new ending ("argo" → "argë").
 * A source word of 4+ letters is flagged when an output word shares all of it but at most its last
 * letter (and at least 3 letters).
 */
export function copiedWords(source: string, output: string, allow: string[] = []): string[] {
  const allowed = [...SHARED_WORDS, ...allow.map(fold)];
  const names = properNames(source);
  const outWords = words(output);
  const flagged = new Set<string>();
  for (const s of new Set(words(source))) {
    if (s.length < 4 || /\d/.test(s) || names.has(s) || allowed.some((a) => s.startsWith(a))) continue;
    for (const o of outWords) {
      if (allowed.some((a) => o.startsWith(a))) continue;
      const shared = longestCommonPrefix(s, o);
      if (shared >= 3 && shared >= Math.min(s.length, o.length) - 1) flagged.add(`${s} → ${o}`);
    }
  }
  return [...flagged];
}

/** Hard checks. `copiedWord` failures count only for tr→sq (Albanian keeps many real Turkish loans). */
export function checkOutput(c: EvalCase, output: string): CheckFailure[] {
  const failures: CheckFailure[] = [];
  const out = ` ${fold(output)} `;
  for (const item of c.mustInclude ?? []) {
    const options = item.split("|").map(fold);
    if (!options.some((o) => out.includes(o))) failures.push({ check: "mustInclude", detail: item });
  }
  for (const item of c.mustNotInclude ?? []) {
    if (out.includes(` ${fold(item)}`)) failures.push({ check: "mustNotInclude", detail: item });
  }
  if (c.direction === "tr-sq") {
    for (const w of copiedWords(c.source, output, c.allowCopy)) failures.push({ check: "copiedWord", detail: w });
  }
  return failures;
}

/** Copied-word warnings for sq→tr (shown in the report, not a failure). */
export function copyWarnings(c: EvalCase, output: string): string[] {
  return c.direction === "sq-tr" ? copiedWords(c.source, output, c.allowCopy) : [];
}

/**
 * chrF (character n-gram F-score, n = 1..6, β = 2), 0..1, accent-insensitive. A rough similarity
 * to the expected translation: reported to spot drift, not used as pass/fail per case.
 */
export function chrF(hypothesis: string, reference: string, maxN = 6, beta = 2): number {
  const h = fold(hypothesis).replace(/ /g, "");
  const r = fold(reference).replace(/ /g, "");
  let precision = 0;
  let recall = 0;
  let orders = 0;
  for (let n = 1; n <= maxN; n++) {
    const hg = ngrams(h, n);
    const rg = ngrams(r, n);
    const hTotal = h.length - n + 1;
    const rTotal = r.length - n + 1;
    if (hTotal <= 0 || rTotal <= 0) continue;
    let match = 0;
    for (const [g, count] of hg) match += Math.min(count, rg.get(g) ?? 0);
    precision += match / hTotal;
    recall += match / rTotal;
    orders++;
  }
  if (!orders) return h === r ? 1 : 0;
  precision /= orders;
  recall /= orders;
  if (!precision && !recall) return 0;
  return ((1 + beta ** 2) * precision * recall) / (beta ** 2 * precision + recall);
}

function ngrams(s: string, n: number) {
  const map = new Map<string, number>();
  for (let i = 0; i + n <= s.length; i++) {
    const g = s.slice(i, i + n);
    map.set(g, (map.get(g) ?? 0) + 1);
  }
  return map;
}
