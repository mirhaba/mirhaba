// UI text as flat "dotted.key" → string pairs, so the admin can edit any single text
// (e.g. "nav.quickTalk") and the override can be laid over messages/<locale>.json.

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Every string leaf of a messages object: [["nav.quickTalk", "Hızlı Konuş"], ...]. Arrays use indexes. */
export function flattenTexts(value: Json, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => flattenTexts(v, prefix ? `${prefix}.${i}` : String(i)));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => flattenTexts(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

/**
 * A copy of `messages` with overrides applied. Only keys that already exist and hold a string are
 * replaced, so a stale or mistyped key can never change the shape the app expects.
 */
export function applyTextOverrides<T>(messages: T, overrides: Record<string, string>): T {
  const keys = Object.keys(overrides);
  if (!keys.length) return messages;
  const copy = structuredClone(messages) as Json;
  for (const key of keys) {
    const path = key.split(".");
    let node: Json = copy;
    for (const part of path.slice(0, -1)) {
      node = node && typeof node === "object" ? ((node as Record<string, Json>)[part] ?? null) : null;
    }
    const last = path.at(-1)!;
    if (node && typeof node === "object" && typeof (node as Record<string, Json>)[last] === "string") {
      (node as Record<string, Json>)[last] = overrides[key];
    }
  }
  return copy as T;
}
