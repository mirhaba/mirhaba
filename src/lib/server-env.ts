import "server-only";

/**
 * A server-only environment variable, cleaned of the usual copy-paste accidents: surrounding
 * spaces and a pair of wrapping quotes ("value" or 'value'). Vercel stores exactly what was
 * pasted, so `"https://x.upstash.io"` would otherwise reach the client library with the quotes.
 * Returns undefined when the variable is unset or empty.
 */
export function serverEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = raw.trim().replace(/^(["'])([\s\S]*)\1$/, "$2").trim();
  return value || undefined;
}

/** True when the stored value had wrapping quotes or spaces (shown on Admin → System check). */
export function envNeedsCleanup(name: string): boolean {
  const raw = process.env[name];
  return raw !== undefined && raw !== "" && serverEnv(name) !== raw;
}
