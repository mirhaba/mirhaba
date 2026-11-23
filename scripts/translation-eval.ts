// Translation regression run: translates every case in evals/translation/cases.json with the
// app's own prompt, glossary matching and model (src/lib/translate/engine.ts), then scores it.
//
//   npm run eval                      all 116 cases; writes evals/translation/last-run.json
//   npm run eval -- --only=slang      only cases with this tag or id (comma-separated); writes nothing
//
// Run it after EVERY prompt, model or glossary-format change and commit last-run.json:
// `npm run eval:check` (and CI) fails while the recorded run doesn't match the current setup.
//   npm run eval -- --tpm=30000       pace for a higher Groq limit (default 8000 tokens/min; 0 = no pacing)
//
// Paced to stay under Groq's tokens-per-minute limit: a full run takes about 20 minutes at 8000.
// Needs GROQ_API_KEY (reads .env.local). TRANSLATION_MODEL overrides the model, as in the app.
// The glossary is the starter dictionary (src/content/slang.ts), which the database is seeded from.
//
// Exit code 1 when any hard check fails (mustInclude, mustNotInclude, copied Turkish word in Albanian).

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { slang } from "../src/content/slang.ts";
import {
  DEFAULT_MODEL,
  matchGlossary,
  promptFingerprint,
  PROMPT_VERSION,
  runTranslation,
  TranslationUnavailable,
} from "../src/lib/translate/engine.ts";
import { checkOutput, chrF, copyWarnings, type CheckFailure, type EvalCase } from "../evals/translation/checks.ts";

const CASES_URL = new URL("../evals/translation/cases.json", import.meta.url);
const LAST_RUN_URL = new URL("../evals/translation/last-run.json", import.meta.url);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const apiKey = process.env.GROQ_API_KEY?.trim().replace(/^(["'])(.*)\1$/, "$2");
if (!apiKey) {
  console.error("GROQ_API_KEY is not set (put it in .env.local, or export it).");
  process.exit(1);
}
const model = args.model || process.env.TRANSLATION_MODEL?.trim() || DEFAULT_MODEL;
const tpm = Number(args.tpm ?? (process.env.GROQ_TPM?.trim() || 8000));
if (!Number.isFinite(tpm) || tpm < 0) {
  console.error("--tpm / GROQ_TPM must be a number of tokens per minute (0 = no pacing).");
  process.exit(1);
}

const casesRaw = readFileSync(CASES_URL, "utf8");
const allCases = (JSON.parse(casesRaw) as { cases: EvalCase[] }).cases;
const only = args.only?.split(",").filter(Boolean);
const cases = only ? allCases.filter((c) => only.includes(c.id) || c.tags?.some((t) => only.includes(t))) : allCases;
if (!cases.length) {
  console.error(`No cases match --only=${args.only}`);
  process.exit(1);
}

type CaseResult = {
  id: string;
  source: string;
  expected: string;
  output: string;
  glossary: string[];
  chrF: number;
  failures: CheckFailure[];
  warnings: string[];
  error?: string;
};

// ---------------------------------------------------------------- pacing

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rate-limit waits per case before giving up on it. */
const MAX_WAITS = 5;

let nextStart = 0;

/** How long Groq asks to wait, from its message ("Please try again in 1m2.5s" / "997.5ms"). */
function retryDelayMs(message: string): number {
  const m = /try again in (?:(d+)h)?(?:(d+)m(?!s))?(?:([d.]+)(ms|s))?/.exec(message);
  if (!m) return 0;
  const seconds = m[3] ? Number(m[3]) / (m[4] === "ms" ? 1000 : 1) : 0;
  return (Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + seconds) * 1000;
}

/** One translation, started once the previous ones' tokens have been refilled; waits out 429s. */
async function pacedTranslation(...params: Parameters<typeof runTranslation>) {
  for (let waits = 0; ; waits++) {
    await sleep(Math.max(0, nextStart - Date.now()));
    const startedAt = Date.now();
    try {
      const result = await runTranslation(...params);
      // Cases run one at a time when paced, so spacing starts by tokens used keeps us under the limit.
      if (tpm) nextStart = startedAt + ((result.inputTokens + result.outputTokens) / (tpm * 0.95)) * 60_000;
      return result;
    } catch (error) {
      if (!(error instanceof TranslationUnavailable) || !error.message.startsWith("groq 429")) throw error;
      if (/per day|((?:TPD|RPD))/i.test(error.message)) {
        // Every remaining case would fail the same way, so the run says nothing about quality.
        console.error(`
Groq's daily limit is used up; stopped without recording a run.
${error.message}`);
        process.exit(1);
      }
      if (waits >= MAX_WAITS) throw error;
      nextStart = Date.now() + Math.min(60_000, Math.max(retryDelayMs(error.message), 5_000 * (waits + 1)));
    }
  }
}

const concurrency = tpm ? 1 : Math.max(1, Number(args.concurrency) || 4);

async function runCase(c: EvalCase): Promise<CaseResult> {
  const glossary = matchGlossary(c.source, slang);
  const base = { id: c.id, source: c.source, expected: c.expected, glossary: glossary.map((g) => g.term.text) };
  try {
    const result = await pacedTranslation(
      { text: c.source, direction: c.direction, variant: c.variant, uiLang: c.direction === "tr-sq" ? "tr" : "sq", glossary },
      { apiKey: apiKey!, model, timeoutMs: 30_000 },
    );
    return {
      ...base,
      output: result.translation,
      chrF: Number(chrF(result.translation, c.expected).toFixed(3)),
      failures: checkOutput(c, result.translation),
      warnings: copyWarnings(c, result.translation),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...base, output: "", chrF: 0, failures: [], warnings: [], error: message };
  }
}

const results: CaseResult[] = new Array(cases.length);
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(concurrency, cases.length) }, async () => {
    while (next < cases.length) {
      const i = next++;
      results[i] = await runCase(cases[i]);
      const r = results[i];
      const mark = r.error ? "ERR " : r.failures.length ? "FAIL" : "ok  ";
      console.log(`${mark} ${r.id}  ${r.source}  →  ${r.output || r.error}`);
    }
  }),
);

const failed = results.filter((r) => r.failures.length || r.error);
const avgChrF = results.reduce((sum, r) => sum + r.chrF, 0) / results.length;

console.log(`\n${results.length - failed.length}/${results.length} passed · average chrF ${avgChrF.toFixed(3)} · ${model} · ${PROMPT_VERSION}`);
for (const r of failed) {
  console.log(`\n✗ ${r.id}: ${r.source}\n  got:      ${r.output || "(no output)"}\n  expected: ${r.expected}`);
  if (r.error) console.log(`  error: ${r.error}`);
  for (const f of r.failures) console.log(`  ${f.check}: ${f.detail}`);
}
const warned = results.filter((r) => r.warnings.length);
if (warned.length) {
  console.log("\nCheck by hand (Albanian word kept in Turkish; often a real loanword):");
  for (const r of warned) console.log(`  ${r.id}: ${r.warnings.join(", ")}`);
}
const low = results.filter((r) => !r.error && r.chrF < 0.25);
if (low.length) {
  console.log("\nFar from the expected translation (may still be right; worth a look):");
  for (const r of low) console.log(`  ${r.id} (chrF ${r.chrF}): ${r.output}  |  expected: ${r.expected}`);
}

if (!only) {
  writeFileSync(
    LAST_RUN_URL,
    JSON.stringify(
      {
        $comment: "Written by `npm run eval`. Commit it: `npm run eval:check` compares it with the current prompt/model/cases.",
        ranAt: new Date().toISOString(),
        model,
        promptVersion: PROMPT_VERSION,
        promptFingerprint: promptFingerprint(model),
        casesHash: createHash("sha256").update(casesRaw).digest("hex").slice(0, 16),
        passed: results.length - failed.length,
        total: results.length,
        averageChrF: Number(avgChrF.toFixed(3)),
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`\nWrote ${LAST_RUN_URL.pathname.replace(process.cwd() + "/", "")}`);
}

process.exit(failed.length ? 1 : 0);
