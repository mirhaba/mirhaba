// CORS for /api (used by src/proxy.ts). No imports, so `npm test` can load it directly.
//
// The site itself is same-origin and needs none of this. CORS_ALLOWED_ORIGINS lists the *other*
// sites whose browser code may call the API. Cookies are never allowed cross-origin
// (no Access-Control-Allow-Credentials), and "*" is ignored.

/** Cookie-based or server-to-server routes: never readable from another site, whatever the list says. */
const PRIVATE_API = /^\/api\/(auth|account|consent|cron|payments)(\/|$)/;

const METHODS = "GET, POST, OPTIONS";
const HEADERS = "Content-Type, Authorization";

/** "https://a.com, b.com/ " → clean origins. Tolerates quotes, spaces, trailing slashes and a missing https://. */
export function parseOrigins(raw: string | undefined): Set<string> {
  const origins = new Set<string>();
  for (const part of (raw ?? "").replace(/["']/g, "").split(/[\s,]+/)) {
    if (!part || part.includes("*")) continue;
    try {
      const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(part) ? part : `https://${part}`);
      if (url.protocol === "https:" || url.protocol === "http:") origins.add(url.origin);
    } catch {
      // Not a URL: skip it rather than break every request.
    }
  }
  return origins;
}

export type CorsResult = { preflight: boolean; allowed: boolean; headers: Record<string, string> };

/** What to answer for one /api request. Without Access-Control-Allow-Origin the browser blocks the other site. */
export function corsFor(
  request: { method: string; pathname: string; origin: string | null; requestedMethod: string | null },
  allowedOrigins: ReadonlySet<string>,
): CorsResult {
  const { method, pathname, origin, requestedMethod } = request;
  const preflight = method === "OPTIONS" && !!origin && !!requestedMethod;
  if (PRIVATE_API.test(pathname)) return { preflight, allowed: false, headers: {} };

  // Always vary, so a cache never reuses one site's answer for another.
  const headers: Record<string, string> = { Vary: "Origin" };
  const allowed = !!origin && allowedOrigins.has(origin);
  if (allowed) {
    headers["Access-Control-Allow-Origin"] = origin;
    if (preflight) {
      headers["Access-Control-Allow-Methods"] = METHODS;
      headers["Access-Control-Allow-Headers"] = HEADERS;
      headers["Access-Control-Max-Age"] = "600";
    }
  }
  return { preflight, allowed, headers };
}
