// Where each dictionary entry comes from. Shown on every word page so claims are traceable.

export type SourceId = "husaj2018" | "wiktKosovo" | "wikiGheg" | "polychat" | "team";

export const sources: Record<SourceId, { label: string; url?: string }> = {
  husaj2018: {
    label: "Husaj, L. (2018). Arnavut Diasporasındaki Türkçe Unsurlar. TÜRÜK Dergisi 6(15), 258–269 (Priştine Üniversitesi)",
    url: "https://dergipark.org.tr/en/download/article-file/631830",
  },
  wiktKosovo: {
    label: "Wiktionary: Kosovo Albanian",
    url: "https://en.wiktionary.org/wiki/Category:Kosovo_Albanian",
  },
  wikiGheg: {
    label: "Wikipedia: Gheg Albanian",
    url: "https://en.wikipedia.org/wiki/Gheg_Albanian",
  },
  polychat: {
    label: "PolyChat: Albanian slang words (Kosovo section)",
    url: "https://www.polychatapp.com/blog/albanian-slang-words",
  },
  team: { label: "Mirhaba team (not yet checked by a native speaker)" },
};
