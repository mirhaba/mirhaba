import type { SlangEntry } from "@/lib/content/model";
import { getDictionaryEntries } from "@/lib/content/queries";
import { matchGlossary } from "@/lib/translate/engine";

export { glossaryForPrompt, glossaryNote } from "@/lib/translate/engine";

/**
 * Glossary entries (database dictionary, or the starter list when it is empty) whose words appear
 * in the text: whole words or inflected forms ("argoyu"), accent-insensitive.
 */
export async function findGlossaryMatches(text: string): Promise<SlangEntry[]> {
  return matchGlossary(text, await getDictionaryEntries());
}
