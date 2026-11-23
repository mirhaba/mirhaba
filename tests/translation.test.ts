// npm test: glossary matching/injection and the regression set's own consistency. No network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { slang } from "../src/content/slang.ts";
import { buildRequestBody, buildUserMessage, matchGlossary, SYSTEM } from "../src/lib/translate/engine.ts";
import { checkOutput, chrF, copiedWords, type EvalCase } from "../evals/translation/checks.ts";

const cases = (JSON.parse(readFileSync(new URL("../evals/translation/cases.json", import.meta.url), "utf8")) as { cases: EvalCase[] }).cases;
const terms = (text: string) => matchGlossary(text, slang).map((e) => e.term.text);

test("argo → zhargon is in the glossary", () => {
  const argo = slang.find((e) => e.slug === "argo");
  assert.ok(argo);
  assert.equal(argo.sqStandard, "zhargon");
});

test("the glossary matches argo in every form, so it reaches the prompt", () => {
  for (const text of ["Kosova'da Arnavutça, argo dahil", "Argoyu nereden öğrendin?", "Bu argodan geliyor", "ARGO"]) {
    assert.ok(terms(text).includes("argo"), text);
  }
  const message = buildUserMessage({
    text: "Kosova'da Arnavutça, argo dahil",
    direction: "tr-sq",
    variant: "kosovan",
    uiLang: "tr",
    glossary: matchGlossary("Kosova'da Arnavutça, argo dahil", slang),
  });
  assert.match(message, /Glossary/);
  assert.match(message, /"argo".*zhargon/);
});

test("the glossary goes into the request sent to the model", () => {
  const body = buildRequestBody("model", {
    text: "Naber kanka?",
    direction: "tr-sq",
    variant: "kosovan",
    uiLang: "tr",
    glossary: matchGlossary("Naber kanka?", slang),
  });
  const user = body.messages.find((m) => m.role === "user")!.content;
  assert.match(user, /"kanka"/);
  assert.match(user, /"naber"/);
});

test("short glossary words only match whole words", () => {
  assert.ok(!terms("Nerede kaldın?").includes("çka"));
  assert.ok(!terms("abiye elbise").includes("abi"));
  assert.ok(terms("Abi, kapıdayım.").includes("abi"));
});

test("the system prompt forbids copying or Albanianising Turkish words", () => {
  assert.match(SYSTEM, /never "Albanianise"/);
  assert.match(SYSTEM, /natural Kosovan equivalent/);
  assert.match(SYSTEM, /"argë" is not a word/);
});

test("the regression set: 50 + 50 cases, unique ids, the argo case included", () => {
  assert.equal(cases.filter((c) => c.direction === "tr-sq").length, 50);
  assert.equal(cases.filter((c) => c.direction === "sq-tr").length, 50);
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  const argo = cases.find((c) => c.source === "Kosova'da Arnavutça, argo dahil");
  assert.equal(argo?.expected, "Shqipja e Kosovës, edhe me zhargon");
});

test("every expected translation passes its own checks", () => {
  for (const c of cases) assert.deepEqual(checkOutput(c, c.expected), [], `${c.id}: ${c.expected}`);
});

test("the checks catch the original bug", () => {
  const c = cases.find((x) => x.id === "tr-sq-001")!;
  const failures = checkOutput(c, "Shqipja në Kosovë, përfshirë argë");
  assert.ok(failures.some((f) => f.check === "mustInclude" && f.detail === "zhargon"));
  assert.ok(failures.some((f) => f.check === "mustNotInclude" && f.detail === "argë"));
  assert.ok(copiedWords("argo dahil", "edhe argë").length > 0);
  assert.ok(chrF(c.expected, c.expected) > 0.99);
});
