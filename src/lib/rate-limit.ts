import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/server-env";

/**
 * Rate limits for sensitive endpoints (sliding window, per user and/or per IP).
 *
 * - With UPSTASH_REDIS_REST_URL + _TOKEN set (production): shared limits across all
 *   Vercel instances via Upstash Redis.
 * - Without them in development: an in-memory limiter, so the behaviour can be tested locally.
 * - Without them in production: limits are skipped (logged once). Supabase's own auth limits
 *   and the per-day quotas in Postgres still apply, so a missing env var never locks people out.
 */

type Rule = { limit: number; window: Duration };

/** Every limit in the app, in one place. */
export const RULES = {
  // Login: stop email-bombing and code guessing.
  sendCodeIp: { limit: 5, window: "10 m" },
  sendCodeEmail: { limit: 3, window: "10 m" },
  verifyCodeIp: { limit: 10, window: "10 m" },
  verifyCodeEmail: { limit: 6, window: "10 m" },
  // Translation: bursts (the daily quota is enforced separately in Postgres).
  translateUser: { limit: 12, window: "1 m" },
  translateIp: { limit: 30, window: "1 m" },
  correctionUser: { limit: 10, window: "1 h" },
  // Other endpoints.
  consentIp: { limit: 20, window: "1 m" },
  exportUser: { limit: 5, window: "1 h" },
  // Learn progress sync (on the Learn page and after each lesson).
  learnSyncUser: { limit: 30, window: "1 m" },
  favoritesSyncUser: { limit: 30, window: "1 m" },
  // Payments: starting checkouts, checking a payment's status, RaiAccept notifications per payment.
  checkoutUser: { limit: 10, window: "10 m" },
  paymentCheckUser: { limit: 30, window: "1 m" },
  paymentWebhook: { limit: 30, window: "1 m" },
} satisfies Record<string, Rule>;

export type RuleName = keyof typeof RULES;

const hasUpstash = !!serverEnv("UPSTASH_REDIS_REST_URL") && !!serverEnv("UPSTASH_REDIS_REST_TOKEN");

/** Upstash client from the (cleaned) env vars. Also used by Admin → System check. */
export function upstashRedis(): Redis {
  return new Redis({ url: serverEnv("UPSTASH_REDIS_REST_URL") ?? "", token: serverEnv("UPSTASH_REDIS_REST_TOKEN") ?? "" });
}
const isProduction = process.env.NODE_ENV === "production" && !!process.env.VERCEL_ENV;

const limiters = new Map<RuleName, Ratelimit>();
function upstash(name: RuleName): Ratelimit {
  let limiter = limiters.get(name);
  if (!limiter) {
    const rule = RULES[name];
    limiter = new Ratelimit({
      redis: upstashRedis(),
      limiter: Ratelimit.slidingWindow(rule.limit, rule.window),
      prefix: `mirhaba:rl:${name}`,
      ephemeralCache: new Map(), // answers repeated blocks from memory, saving Redis calls
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

// ---------- Development fallback (single process only) ----------
const memory = new Map<string, number[]>();
function toMs(window: Duration): number {
  const [value, unit] = window.split(" ") as [string, string];
  const n = Number(value);
  return n * ({ ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 1_000);
}
function memoryLimit(name: RuleName, key: string): boolean {
  const { limit, window } = RULES[name];
  const now = Date.now();
  const id = `${name}:${key}`;
  const hits = (memory.get(id) ?? []).filter((t) => now - toMs(window) < t);
  if (hits.length >= limit) {
    memory.set(id, hits);
    return false;
  }
  hits.push(now);
  memory.set(id, hits);
  return true;
}

let warned = false;

/** Returns true when the request may proceed. Fails open if Redis itself is down. */
export async function checkLimit(name: RuleName, rawKey: string): Promise<boolean> {
  if (!rawKey) return true;
  // IPs, emails and ids are personal data: Redis only ever sees a hash.
  const key = hashKey(rawKey);
  if (hasUpstash) {
    try {
      const { success } = await upstash(name).limit(key);
      return success;
    } catch (error) {
      console.error("rate limit check failed", error instanceof Error ? error.message : error);
      return true;
    }
  }
  if (isProduction) {
    if (!warned) console.error("UPSTASH_REDIS_REST_URL/TOKEN missing: rate limits are OFF in production");
    warned = true;
    return true;
  }
  return memoryLimit(name, key);
}

/** All given checks must pass. Runs them in parallel. */
export async function checkLimits(checks: [RuleName, string][]): Promise<boolean> {
  const results = await Promise.all(checks.map(([name, key]) => checkLimit(name, key)));
  return results.every(Boolean);
}

/** Best-effort client IP (Vercel sets x-real-ip; the first x-forwarded-for hop otherwise). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Keys are hashed so no IP, email or user id is stored in Redis. */
export function hashKey(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}
