// Fails when the translation prompt, model or regression cases changed since the last recorded
// regression run (evals/translation/last-run.json), or when that run had failures.
// No network, no API key: safe for CI and pre-commit.
//
//   npm run eval:check
//
// Fix: run `npm run eval` (needs GROQ_API_KEY), fix any failures, commit last-run.json.

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DEFAULT_MODEL, promptFingerprint, PROMPT_VERSION } from "../src/lib/translate/engine.ts";

const casesRaw = readFileSync(new URL("../evals/translation/cases.json", import.meta.url), "utf8");
const lastRunUrl = new URL("../evals/translation/last-run.json", import.meta.url);
const model = process.env.TRANSLATION_MODEL?.trim() || DEFAULT_MODEL;

const problems: string[] = [];
if (!existsSync(lastRunUrl)) {
  problems.push("No regression run recorded yet.");
} else {
  const last = JSON.parse(readFileSync(lastRunUrl, "utf8")) as {
    model: string;
    promptVersion: string;
    promptFingerprint: string;
    casesHash: string;
    passed: number;
    total: number;
    ranAt: string;
  };
  if (last.model !== model) problems.push(`Model changed: last run used ${last.model}, now ${model}.`);
  else if (last.promptFingerprint !== promptFingerprint(model)) {
    problems.push(
      `The prompt or request settings changed since the last run (${last.promptVersion} → ${PROMPT_VERSION}${
        last.promptVersion === PROMPT_VERSION ? "; also bump PROMPT_VERSION so cached answers aren't reused" : ""
      }).`,
    );
  }
  if (last.casesHash !== createHash("sha256").update(casesRaw).digest("hex").slice(0, 16)) {
    problems.push("evals/translation/cases.json changed since the last run.");
  }
  if (last.passed !== last.total) problems.push(`The last run (${last.ranAt}) had ${last.total - last.passed} failing case(s).`);
}

if (problems.length) {
  console.error(["Translation regression run is out of date:", ...problems.map((p) => `  - ${p}`)].join("\n"));
  console.error("Run `npm run eval`, fix any failures, and commit evals/translation/last-run.json.");
  process.exit(1);
}
console.log(`Translation regression run is current (${PROMPT_VERSION}, ${model}).`);
