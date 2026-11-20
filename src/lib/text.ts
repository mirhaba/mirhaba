// Text helpers for Turkish + Albanian. Pure functions, safe on server and client.

/**
 * Search normalisation: lower-case with the right locale rules, then fold
 * diacritics so "qysh" matches "qyshë", "cka" matches "çka", "kapi" matches "kapı".
 */
export function normalizeForSearch(input: string): string {
  return input
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Albanian letter → closest Turkish spelling. In Kosovo q/ç and gj/xh sound the same.
// "dh" (as in English "this") and "th" (as in "think") have no Turkish letter and stay as-is.
const READING: Record<string, string> = {
  xh: "c",
  gj: "c",
  zh: "j",
  sh: "ş",
  nj: "ny",
  ll: "l",
  rr: "r",
  dh: "dh",
  th: "th",
  q: "ç",
  ç: "ç",
  c: "ts",
  x: "dz",
  j: "y",
  y: "ü",
  ë: "ı",
};
// Digraphs first so "xh" never splits into "x" + "h".
const READING_PATTERN = /xh|gj|zh|sh|nj|ll|rr|dh|th|[qçcxjyë]/g;

/**
 * A rough Turkish-alphabet reading of Albanian text, so Turkish speakers can try
 * saying it themselves. A hint, not a phonetic transcription.
 * e.g. "Jam te dera" → "yam te dera", "Mirëmëngjes" → "mirımınces".
 */
export function albanianReading(text: string): string {
  return text
    .toLocaleLowerCase("sq")
    .replace(/(?<=\p{L}{2})ë(?=[\s.,!?;:…]|$)/gu, "") // word-final ë is usually silent ("derë" → "der")
    .replace(READING_PATTERN, (m) => READING[m] ?? m);
}
