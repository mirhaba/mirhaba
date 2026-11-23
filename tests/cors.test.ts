// npm test: which sites may call /api from a browser. No network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { corsFor, parseOrigins } from "../src/lib/cors.ts";

const list = parseOrigins("https://partner.example");
const call = (over: Partial<Parameters<typeof corsFor>[0]> = {}) =>
  corsFor({ method: "GET", pathname: "/api/share", origin: "https://partner.example", requestedMethod: null, ...over }, list);

test("origins are cleaned; wildcards, other schemes and junk are ignored", () => {
  assert.deepEqual(
    [...parseOrigins(`"https://A.com/, b.com  http://localhost:8081/x", *, https://*.c.com, file:///x, https://`)],
    ["https://a.com", "https://b.com", "http://localhost:8081"],
  );
  assert.equal(parseOrigins(undefined).size, 0);
});

test("a listed site is allowed, without cookies", () => {
  const { headers } = call();
  assert.equal(headers["Access-Control-Allow-Origin"], "https://partner.example");
  assert.equal(headers["Access-Control-Allow-Credentials"], undefined);
});

test("lookalike, null and missing origins get nothing", () => {
  for (const origin of ["https://partner.example.evil.com", "http://partner.example", "null", null]) {
    const { allowed, headers } = call({ origin });
    assert.equal(allowed, false);
    assert.deepEqual(headers, { Vary: "Origin" });
  }
});

test("preflight answers methods and headers", () => {
  const r = call({ method: "OPTIONS", requestedMethod: "POST" });
  assert.ok(r.preflight && r.allowed);
  assert.match(r.headers["Access-Control-Allow-Methods"], /POST/);
});

test("private routes are never opened, even to a listed site", () => {
  for (const p of ["auth/session", "account/export", "consent", "cron/reminders", "payments/raiaccept/webhook"]) {
    assert.deepEqual(call({ pathname: `/api/${p}`, method: "OPTIONS", requestedMethod: "POST" }), { preflight: true, allowed: false, headers: {} });
  }
});
