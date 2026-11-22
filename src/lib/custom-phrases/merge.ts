// Own Quick Talk phrases: merging this phone's list with the account's. Pure and symmetric, so
// syncing twice or from several phones is always safe. Rule per phrase: the newer change wins; at
// the same time a delete wins. Then at most MAX_CUSTOM_PHRASES stay (the newest); older ones become
// tombstones. The same limit is enforced in SQL (custom_phrases_check_limit).

import { z } from "zod";

export const MAX_CUSTOM_PHRASES = 50;
export const MAX_PHRASE_CHARS = 200;

export const customPhraseSchema = z.object({
  id: z.uuid(),
  tr: z.string().max(MAX_PHRASE_CHARS),
  sq: z.string().max(MAX_PHRASE_CHARS),
  updatedAt: z.number().int().min(0),
  deleted: z.boolean(),
});
export const customPhrasesSchema = z.array(customPhraseSchema).max(500);

export type CustomPhrase = z.infer<typeof customPhraseSchema>;

function newer(a: CustomPhrase, b: CustomPhrase): CustomPhrase {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  if (a.deleted !== b.deleted) return a.deleted ? a : b;
  // Same time, same state: pick deterministically so merge(a, b) === merge(b, a).
  return `${a.tr}\u0000${a.sq}` >= `${b.tr}\u0000${b.sq}` ? a : b;
}

export function mergeCustomPhrases(a: CustomPhrase[], b: CustomPhrase[]): CustomPhrase[] {
  const byId = new Map<string, CustomPhrase>();
  for (const row of [...a, ...b]) {
    const prev = byId.get(row.id);
    byId.set(row.id, prev ? newer(prev, row) : row);
  }
  const all = [...byId.values()];
  const live = all.filter((r) => !r.deleted).sort((x, y) => y.updatedAt - x.updatedAt || (x.id < y.id ? 1 : -1));
  const dropped = new Set(live.slice(MAX_CUSTOM_PHRASES).map((r) => r.id));
  return all
    .map((r) => (dropped.has(r.id) ? { ...r, deleted: true } : r))
    .sort((x, y) => x.updatedAt - y.updatedAt || (x.id < y.id ? -1 : 1));
}
