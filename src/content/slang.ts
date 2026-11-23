// Slang & dialect dictionary (Kosovo / Prishtina Albanian ↔ Turkish).
//
// Three kinds of entries:
//  - "kosovan":       how people in Kosovo say it vs standard Albanian (qysh, çka, kerr, gepek…)
//  - "loanword":      Turkish words still used in Kosovo Albanian ("you already know these")
//  - "turkish_slang": Turkish street words and the Kosovan way to say them (kanka, abi, naber…)
//
// Every entry lists its sources. `verified` stays false until a native Prishtina speaker has
// checked it; the UI says so on every word page. Do NOT add Albania/Tirana-only slang
// (e.g. "lali") as Kosovan: the app is about Kosovo.
//
// Used by: the dictionary pages (/tr/argo, /sq/zhargon), the translation glossary
// (src/lib/glossary.ts) and the database seed (scripts/generate-seed.ts).

import type { Bilingual } from "./quick-talk";

export type Register = "neutral" | "casual" | "vulgar";
export type Origin = "albanian" | "turkish" | "serbian" | "german" | "english" | "latin";
export type Kind = "kosovan" | "loanword" | "turkish_slang";

export type SlangEntry = {
  /** URL slug (ASCII): /tr/argo/<slug>, /sq/zhargon/<slug> */
  slug: string;
  kind: Kind;
  /** The word this page is about, in its own language. */
  term: { text: string; lang: "sq" | "tr" };
  register: Register;
  origin?: Origin;
  /** Turkish equivalent(s). */
  tr: string;
  /** Standard (school) Albanian. */
  sqStandard: string;
  /** How it is said in Kosovo, when different from standard. */
  sqKosovo?: string;
  /** One line: what it means / how it's used. */
  meaning: Bilingual;
  example?: { sq: string; tr: string };
  /** Ids from `content_sources` (starter list: src/content/sources.ts). */
  sources: string[];
  /** Checked by a native Prishtina speaker. */
  verified: boolean;
};

const e = (entry: Omit<SlangEntry, "verified">): SlangEntry => ({ ...entry, verified: false });

export const slang: SlangEntry[] = [
  // ---------------------------------------------------------------- Kosovan everyday words
  e({
    slug: "qysh",
    kind: "kosovan",
    term: { text: "qysh", lang: "sq" },
    register: "neutral",
    origin: "albanian",
    tr: "nasıl",
    sqStandard: "si",
    sqKosovo: "qysh",
    meaning: {
      tr: "Kosova'da \"nasıl\" demek için kullanılır; standart Arnavutçadaki \"si\" yerine.",
      sq: "Në Kosovë përdoret për \"si\", në vend të formës standarde.",
    },
    example: { sq: "Qysh je?", tr: "Nasılsın?" },
    sources: ["wikiGheg", "polychat"],
  }),
  e({
    slug: "cka",
    kind: "kosovan",
    term: { text: "çka", lang: "sq" },
    register: "neutral",
    origin: "albanian",
    tr: "ne",
    sqStandard: "çfarë",
    sqKosovo: "çka",
    meaning: {
      tr: "Kosova'da \"ne\" anlamında; standarttaki \"çfarë\" yerine söylenir.",
      sq: "Në Kosovë për \"çfarë\".",
    },
    example: { sq: "Çka po bën?", tr: "Ne yapıyorsun?" },
    sources: ["polychat"],
  }),
  e({
    slug: "cka-ka",
    kind: "kosovan",
    term: { text: "Çka ka?", lang: "sq" },
    register: "casual",
    origin: "albanian",
    tr: "Naber? / Ne var ne yok?",
    sqStandard: "Ç'kemi?",
    sqKosovo: "Çka ka?",
    meaning: {
      tr: "Arkadaşlar arasında \"naber, ne var ne yok\" selamı.",
      sq: "Përshëndetje mes shokëve: \"si je, çfarë ka të re\".",
    },
    example: { sq: "Çka ka, shok?", tr: "Naber dostum?" },
    sources: ["polychat"],
  }),
  e({
    slug: "tash",
    kind: "kosovan",
    term: { text: "tash", lang: "sq" },
    register: "neutral",
    origin: "albanian",
    tr: "şimdi",
    sqStandard: "tani",
    sqKosovo: "tash",
    meaning: { tr: "Kosova'da \"şimdi\" demek.", sq: "Në Kosovë për \"tani\"." },
    example: { sq: "Po vij tash.", tr: "Şimdi geliyorum." },
    sources: ["team"],
  }),
  e({
    slug: "kurgjo",
    kind: "kosovan",
    term: { text: "kurgjo", lang: "sq" },
    register: "neutral",
    origin: "albanian",
    tr: "hiçbir şey",
    sqStandard: "asgjë",
    sqKosovo: "kurgjo",
    meaning: { tr: "Kosova'da \"hiçbir şey\".", sq: "Në Kosovë për \"asgjë\"." },
    example: { sq: "S'ka kurgjo.", tr: "Bir şey yok / Önemli değil." },
    sources: ["team"],
  }),
  e({
    slug: "shpi",
    kind: "kosovan",
    term: { text: "shpi", lang: "sq" },
    register: "neutral",
    origin: "albanian",
    tr: "ev",
    sqStandard: "shtëpi",
    sqKosovo: "shpi",
    meaning: { tr: "Kosova'da \"ev\" kelimesinin günlük söylenişi.", sq: "Forma e folur në Kosovë për \"shtëpi\"." },
    example: { sq: "Po shkoj në shpi.", tr: "Eve gidiyorum." },
    sources: ["team"],
  }),
  e({
    slug: "kerr",
    kind: "kosovan",
    term: { text: "kerr", lang: "sq" },
    register: "neutral",
    origin: "latin",
    tr: "araba",
    sqStandard: "makinë",
    sqKosovo: "kerr",
    meaning: { tr: "Kosova'da \"araba\" için kullanılır.", sq: "Në Kosovë përdoret për \"makinë\"." },
    example: { sq: "Ku e ke kerrin?", tr: "Araban nerede?" },
    sources: ["wiktKosovo"],
  }),
  e({
    slug: "gepek",
    kind: "kosovan",
    term: { text: "gepek", lang: "sq" },
    register: "casual",
    origin: "german",
    tr: "bagaj (arabanın)",
    sqStandard: "bagazh",
    sqKosovo: "gepek",
    meaning: {
      tr: "Arabanın bagajı. Almanca \"Gepäck\"ten gelir; kuryeler için çok kullanışlı.",
      sq: "Bagazhi i veturës. Nga gjermanishtja \"Gepäck\".",
    },
    example: { sq: "Pakoja është në gepek.", tr: "Paket bagajda." },
    sources: ["wiktKosovo"],
  }),
  e({
    slug: "kompire",
    kind: "kosovan",
    term: { text: "kompirë", lang: "sq" },
    register: "neutral",
    origin: "serbian",
    tr: "patates",
    sqStandard: "patate",
    sqKosovo: "kompirë",
    meaning: { tr: "Kosova'da \"patates\"; markette ve pazarda duyarsın.", sq: "Në Kosovë për \"patate\"." },
    sources: ["wiktKosovo"],
  }),
  e({
    slug: "majice",
    kind: "kosovan",
    term: { text: "majicë", lang: "sq" },
    register: "neutral",
    origin: "serbian",
    tr: "tişört, bluz",
    sqStandard: "bluzë",
    sqKosovo: "majicë",
    meaning: { tr: "Kosova'da tişört ya da bluz.", sq: "Në Kosovë për \"bluzë\"." },
    sources: ["wiktKosovo"],
  }),
  e({
    slug: "bicikell",
    kind: "kosovan",
    term: { text: "bicikëll", lang: "sq" },
    register: "neutral",
    origin: "serbian",
    tr: "bisiklet",
    sqStandard: "biçikletë",
    sqKosovo: "bicikëll",
    meaning: { tr: "Kosova'da \"bisiklet\".", sq: "Në Kosovë për \"biçikletë\"." },
    sources: ["wiktKosovo"],
  }),
  e({
    slug: "arsimtar",
    kind: "kosovan",
    term: { text: "arsimtar", lang: "sq" },
    register: "neutral",
    origin: "albanian",
    tr: "öğretmen",
    sqStandard: "mësues",
    sqKosovo: "arsimtar",
    meaning: { tr: "Kosova'da okullarda \"öğretmen\" için kullanılır.", sq: "Në Kosovë për \"mësues\"." },
    sources: ["wiktKosovo"],
  }),
  e({
    slug: "gastarbajter",
    kind: "kosovan",
    term: { text: "gastarbajter", lang: "sq" },
    register: "casual",
    origin: "german",
    tr: "gurbetçi",
    sqStandard: "punëtor mysafir",
    sqKosovo: "gastarbajter",
    meaning: {
      tr: "Yurt dışında (özellikle Almanya, İsviçre) çalışan Kosovalı; Türkçedeki \"gurbetçi\" gibi.",
      sq: "Kosovar që punon jashtë vendit, sidomos në Gjermani e Zvicër.",
    },
    sources: ["wiktKosovo"],
  }),
  e({
    slug: "quze",
    kind: "kosovan",
    term: { text: "quzë", lang: "sq" },
    register: "casual",
    origin: "serbian",
    tr: "kodes, hapis",
    sqStandard: "burg",
    sqKosovo: "quzë",
    meaning: { tr: "Argoda \"hapishane\"; Türkçedeki \"kodes\" gibi.", sq: "Zhargon për \"burg\"." },
    sources: ["wiktKosovo"],
  }),
  e({
    slug: "nub",
    kind: "kosovan",
    term: { text: "nub", lang: "sq" },
    register: "casual",
    origin: "english",
    tr: "acemi, çaylak",
    sqStandard: "fillestar",
    sqKosovo: "nub",
    meaning: { tr: "Gençler arasında \"acemi\"; İngilizce \"noob\"dan.", sq: "Zhargon i të rinjve për \"fillestar\"." },
    sources: ["wiktKosovo"],
  }),
  e({
    slug: "fryfq",
    kind: "kosovan",
    term: { text: "fryfq", lang: "sq" },
    register: "vulgar",
    origin: "albanian",
    tr: "palavracı, şişirik",
    sqStandard: "mburravec",
    sqKosovo: "fryfq",
    meaning: { tr: "Övünüp duran kişi; aşağılayıcı, dikkatli kullan.", sq: "Njeri që mburret; fyese." },
    sources: ["wiktKosovo"],
  }),
  e({
    slug: "hosh-xhelden",
    kind: "kosovan",
    term: { text: "hosh xheldën", lang: "sq" },
    register: "neutral",
    origin: "turkish",
    tr: "hoş geldin",
    sqStandard: "mirë se vjen",
    sqKosovo: "hosh xheldën",
    meaning: {
      tr: "Türkçe \"hoş geldin\"; Kosova Türkçesi üzerinden Arnavutçaya geçmiş.",
      sq: "Nga turqishtja \"hoş geldin\", përmes të folmeve turke të Kosovës.",
    },
    sources: ["wiktKosovo"],
  }),
  e({
    slug: "bre",
    kind: "kosovan",
    term: { text: "bre", lang: "sq" },
    register: "casual",
    tr: "be!, yahu",
    sqStandard: "more",
    sqKosovo: "bre",
    meaning: {
      tr: "Şaşkınlık veya sitem bildiren ünlem; Türkçedeki \"be!\" gibi. Arkadaşça ama sert tonda kaba durabilir.",
      sq: "Pasthirrmë habie ose qortimi, si \"be\" në turqisht.",
    },
    example: { sq: "Hajde bre!", tr: "Hadi be!" },
    sources: ["team"],
  }),

  // ---------------------------------------------------------------- Turkish words used in Kosovo
  ...(
    [
      ["tamam", "tamam", "pikërisht, në rregull", "Tamam, nesër.", "Tamam, yarın."],
      ["hajde", "haydi, hadi", "eja", "Hajde, po vonohemi!", "Hadi, geç kalıyoruz!"],
      ["avash", "yavaş", "ngadalë", "Fol pak më avash.", "Biraz daha yavaş konuş."],
      ["nejse", "neyse", "sido që të jetë", "Nejse, s'ka gajle.", "Neyse, dert değil."],
      ["belesh", "beleş, bedava", "falas", null, null],
      ["badihava", "bedava", "falas", null, null],
      ["zor", "zor", "vështirë", "Është zor me gjet banesë.", "Ev bulmak zor."],
      ["boll", "bol", "mjaft, shumë", "Ka boll.", "Bol bol var."],
      ["dembel", "tembel", "përtac", null, null],
      ["gajle", "kaygı, dert", "brengë", "S'ka gajle.", "Dert değil."],
      ["muhabet", "muhabbet, sohbet", "bisedë", "Bëmë muhabet.", "Muhabbet ettik."],
      ["sefte", "siftah", "fillimi, i pari", null, null],
      ["vallahi", "vallahi", "për besë", null, null],
      ["aferim", "aferin", "bravo", null, null],
      ["ejvallah", "eyvallah", "faleminderit", null, null],
      ["shyqyr", "şükür", "falë Zotit", null, null],
      ["inshalla", "inşallah", "shpresoj", null, null],
      ["qerrata", "kerata", "dredharak", null, null],
      ["taze", "taze", "i freskët", "Buka është taze.", "Ekmek taze."],
      ["rezil", "rezil", "i turpëruar", null, null],
      ["zaten", "zaten", "në të vërtetë", null, null],
      ["demek", "demek", "domethënë", null, null],
      ["bile", "bile", "madje", null, null],
      ["pishman", "pişman", "i penduar", null, null],
      ["axhami", "acemi", "i papërvojë", null, null],
      ["fukara", "fukara", "i varfër", null, null],
      ["xhep", "cep", "xhep", null, null],
      ["carshi", "çarşı", "qendra e qytetit", null, null],
      ["komshi", "komşu", "fqinj", null, null],
      ["bujrum", "buyrun", "urdhëroni", "Bujrëm, hyni!", "Buyrun, girin!"],
      ["ama", "ama", "por", null, null],
    ] as const
  ).map(([word, tr, sqStandard, exampleSq, exampleTr]) => {
    const display: Record<string, string> = {
      carshi: "çarshi",
      bujrum: "bujrëm",
    };
    const text = display[word] ?? word;
    return e({
      slug: word,
      kind: "loanword",
      term: { text, lang: "sq" },
      register: ["qerrata", "rezil", "fukara"].includes(word) ? "casual" : "neutral",
      origin: "turkish",
      tr,
      sqStandard,
      sqKosovo: text,
      meaning: {
        tr: `Türkçe \"${tr.split(",")[0]}\" kelimesinden; Kosova'da günlük konuşmada kullanılır.`,
        sq: `Nga turqishtja; në standard: \"${sqStandard}\".`,
      },
      example: exampleSq && exampleTr ? { sq: exampleSq, tr: exampleTr } : undefined,
      sources: ["husaj2018"],
    });
  }),

  // ---------------------------------------------------------------- Turkish slang → Kosovan
  e({
    slug: "kanka",
    kind: "turkish_slang",
    term: { text: "kanka", lang: "tr" },
    register: "casual",
    tr: "kanka",
    sqStandard: "shok",
    sqKosovo: "shok, vlla",
    meaning: {
      tr: "Çok yakın arkadaş. Kosova'da \"shok\" ya da samimi \"vlla\" (kardeş) denir.",
      sq: "Shok shumë i ngushtë. Në Kosovë: \"shok\" ose \"vlla\".",
    },
    example: { sq: "Çka ka, vlla?", tr: "Naber kanka?" },
    sources: ["team"],
  }),
  e({
    slug: "abi",
    kind: "turkish_slang",
    term: { text: "abi", lang: "tr" },
    register: "neutral",
    tr: "abi, ağabey",
    sqStandard: "vëlla",
    sqKosovo: "vlla",
    meaning: {
      tr: "Saygılı \"ağabey\"; tanımadığın erkeğe de söylenir. Kosova'da en yakın karşılığı \"vlla\".",
      sq: "\"Vëlla\" me respekt; thirrje edhe për të panjohur.",
    },
    sources: ["team"],
  }),
  e({
    slug: "naber",
    kind: "turkish_slang",
    term: { text: "naber", lang: "tr" },
    register: "casual",
    tr: "naber, ne haber",
    sqStandard: "Si je?",
    sqKosovo: "Qysh je? / Çka ka?",
    meaning: { tr: "\"Ne haber, nasılsın\" selamı.", sq: "Përshëndetje: \"si je, çfarë ka\"." },
    example: { sq: "Qysh je?", tr: "Naber?" },
    sources: ["polychat", "wikiGheg"],
  }),
  e({
    slug: "kolay-gelsin",
    kind: "turkish_slang",
    term: { text: "kolay gelsin", lang: "tr" },
    register: "neutral",
    tr: "kolay gelsin",
    sqStandard: "Punë të mbarë",
    meaning: {
      tr: "Çalışan birine iyi dilek. Arnavutçada birebir karşılığı yok; en yakını \"Punë të mbarë\".",
      sq: "Urim për dikë që punon; më i afërti në shqip: \"Punë të mbarë\".",
    },
    sources: ["team"],
  }),
  e({
    slug: "afiyet-olsun",
    kind: "turkish_slang",
    term: { text: "afiyet olsun", lang: "tr" },
    register: "neutral",
    tr: "afiyet olsun",
    sqStandard: "Të bëftë mirë",
    meaning: { tr: "Yemek yiyene iyi dilek.", sq: "Urim për dikë që ha." },
    sources: ["team"],
  }),
  e({
    slug: "gecmis-olsun",
    kind: "turkish_slang",
    term: { text: "geçmiş olsun", lang: "tr" },
    register: "neutral",
    tr: "geçmiş olsun",
    sqStandard: "Shërim të shpejtë",
    meaning: {
      tr: "Hastalık ya da kaza sonrası iyi dilek; Arnavutçada \"çabuk iyileş\" denir.",
      sq: "Urim pas sëmundjes ose fatkeqësisë.",
    },
    sources: ["team"],
  }),
  e({
    slug: "bos-ver",
    kind: "turkish_slang",
    term: { text: "boş ver", lang: "tr" },
    register: "casual",
    tr: "boş ver",
    sqStandard: "Lëre",
    sqKosovo: "Lëre, s'ka gajle",
    meaning: {
      tr: "\"Önemseme, unut gitsin\". Kosova'da Türkçe kökenli \"s'ka gajle\" (dert değil) da denir.",
      sq: "\"Mos u mërzit, lëre\". Në Kosovë edhe \"s'ka gajle\".",
    },
    sources: ["team", "husaj2018"],
  }),
  e({
    // Regression: the model once wrote "argë" (Albanianised Turkish) for this.
    slug: "argo",
    kind: "turkish_slang",
    term: { text: "argo", lang: "tr" },
    register: "neutral",
    tr: "argo",
    sqStandard: "zhargon",
    meaning: {
      tr: "Sokak dili, gündelik konuşma dili. Arnavutçası \"zhargon\"; \"argë\" diye bir kelime yok.",
      sq: "Gjuha e rrugës, e folura e përditshme. Në shqip: \"zhargon\".",
    },
    example: { sq: "Shqipja e Kosovës, edhe me zhargon", tr: "Kosova'da Arnavutça, argo dahil" },
    sources: ["team"],
  }),
];

export const slangBySlug: Record<string, SlangEntry> = Object.fromEntries(slang.map((s) => [s.slug, s]));
