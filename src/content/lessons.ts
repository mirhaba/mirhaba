// Learn Albanian: tracks → units → lessons → items. Taught in Turkish, from zero.
// Exercises are generated from each lesson's items (src/lib/learn/engine.ts), so adding a
// lesson means adding words, not hand-writing every exercise.
//
// Bundled with the app (works offline) and seeded into courses/units/lessons for server-side
// progress later. IMPORTANT: every Albanian line needs a native Prishtina speaker's check.
//
// Language rule: the first two tracks teach standard Albanian (correct anywhere), with a note
// wherever people in Kosovo usually say it differently. The "kosovo-speech" track teaches the
// everyday Prishtina forms, and every item's note gives the standard form, so learners always
// know which is which. Never present a dialect form as standard.
// Where possible items reuse Quick Talk phrases and dictionary words.

import type { Bilingual } from "./quick-talk";

export type Item = {
  /** Stable id: progress and weak-word stats are keyed by it, so never reuse or rename. */
  id: string;
  sq: string;
  tr: string;
  /** Optional hint shown on the learn card (e.g. the standard form of a Kosovan word). */
  note?: Bilingual;
};

export type Lesson = {
  slug: string;
  title: Bilingual;
  /** The real-life situation this lesson is for. */
  situation: Bilingual;
  items: Item[];
};

export type Unit = {
  slug: string;
  title: Bilingual;
  /** First units of every track are free; later units are Premium (build plan: Free vs paid). */
  isFree: boolean;
  lessons: Lesson[];
};

export type Track = {
  slug: string;
  title: Bilingual;
  description: Bilingual;
  /** Lucide icon key, see TRACK_ICONS in the learn home. */
  icon: "plane" | "map" | "message";
  units: Unit[];
};

export const tracks: Track[] = [
  {
    slug: "before-you-move",
    title: { tr: "Taşınmadan önce", sq: "Para se të vish" },
    description: { tr: "İlk kelimeler: selamlaşma, kendini tanıtma, sayılar.", sq: "Fjalët e para: përshëndetje, prezantim, numra." },
    icon: "plane",
    units: [
      {
        slug: "first-steps",
        title: { tr: "İlk adımlar", sq: "Hapat e parë" },
        isFree: true,
        lessons: [
          {
            slug: "greetings",
            title: { tr: "Selamlaşma", sq: "Përshëndetjet" },
            situation: { tr: "Birine merhaba ve hoşça kal demek", sq: "Të përshëndetësh dhe të ndahesh" },
            items: [
              { id: "pershendetje", sq: "përshëndetje", tr: "merhaba", note: { tr: "Kosova'da konuşurken daha çok: Tung! (samimi) ya da Mirëdita! (resmî)", sq: "Në të folur më shpesh: Tung! ose Mirëdita!" } },
              { id: "mirmengjes", sq: "mirëmëngjes", tr: "günaydın" },
              { id: "mirdita", sq: "mirëdita", tr: "iyi günler" },
              { id: "mirmbrema", sq: "mirëmbrëma", tr: "iyi akşamlar" },
              { id: "mirupafshim", sq: "mirupafshim", tr: "hoşça kal, görüşürüz", note: { tr: "Samimi: Shihemi! ya da Tung!", sq: "Shoqërisht: Shihemi! ose Tung!" } },
              { id: "faleminderit", sq: "faleminderit", tr: "teşekkürler" },
              { id: "ju-lutem", sq: "ju lutem", tr: "lütfen", note: { tr: "Kibar \"siz\" hâli. Samimi (sen): të lutem", sq: "Me \"ju\". Me \"ti\": të lutem" } },
              { id: "po", sq: "po", tr: "evet" },
              { id: "jo", sq: "jo", tr: "hayır" },
            ],
          },
          {
            slug: "about-me",
            title: { tr: "Kendini tanıt", sq: "Prezantohu" },
            situation: { tr: "Yeni komşuyla ya da iş yerinde tanışmak", sq: "Njihesh me fqinjin ose në punë" },
            items: [
              { id: "une-jam", sq: "Unë jam Ahmet.", tr: "Ben Ahmet'im." },
              { id: "jam-nga-turqia", sq: "Jam nga Turqia.", tr: "Türkiye'denim." },
              { id: "si-e-ke-emrin", sq: "Si e ke emrin?", tr: "Adın ne?", note: { tr: "Kosova'da: Qysh e ke emrin?", sq: "Në Kosovë: Qysh e ke emrin?" } },
              { id: "me-vjen-mire", sq: "Më vjen mirë.", tr: "Memnun oldum." },
              { id: "jetoj-ne-prishtine", sq: "Jetoj në Prishtinë.", tr: "Priştine'de yaşıyorum." },
              { id: "nuk-e-flas-mire", sq: "Nuk e flas mirë shqipen.", tr: "Arnavutçam iyi değil.", note: { tr: "Kosova'da günlük: S'di mirë shqip.", sq: "Në të folur: S'di mirë shqip." } },
              { id: "a-flisni-turqisht", sq: "A flisni turqisht?", tr: "Türkçe konuşuyor musunuz?" },
            ],
          },
          {
            slug: "numbers",
            title: { tr: "Sayılar 1–10", sq: "Numrat 1–10" },
            situation: { tr: "Fiyat, kat ve dakika söylemek", sq: "Çmimi, kati dhe minutat" },
            items: [
              { id: "num-1", sq: "një", tr: "bir (1)" },
              { id: "num-2", sq: "dy", tr: "iki (2)" },
              { id: "num-3", sq: "tre", tr: "üç (3)", note: { tr: "Dişil kelimelerle: tri (tri orë = üç saat)", sq: "Me emra femërorë: tri (tri orë)" } },
              { id: "num-4", sq: "katër", tr: "dört (4)" },
              { id: "num-5", sq: "pesë", tr: "beş (5)" },
              { id: "num-6", sq: "gjashtë", tr: "altı (6)" },
              { id: "num-7", sq: "shtatë", tr: "yedi (7)" },
              { id: "num-8", sq: "tetë", tr: "sekiz (8)" },
              { id: "num-9", sq: "nëntë", tr: "dokuz (9)" },
              { id: "num-10", sq: "dhjetë", tr: "on (10)" },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "daily-life",
    title: { tr: "Günlük hayat", sq: "Jeta e përditshme" },
    description: { tr: "Kapıda, sokakta ve markette hayatta kalma Arnavutçası.", sq: "Shqipja e mbijetesës te dera, në rrugë e në market." },
    icon: "map",
    units: [
      {
        slug: "out-and-about",
        title: { tr: "Kapıda ve sokakta", sq: "Te dera dhe në rrugë" },
        isFree: true,
        lessons: [
          {
            slug: "at-the-door",
            title: { tr: "Kapıda", sq: "Te dera" },
            situation: { tr: "Sipariş teslim etmek", sq: "Dorëzimi i një porosie" },
            items: [
              { id: "jam-te-dera", sq: "Jam te dera.", tr: "Kapıdayım." },
              { id: "porosia", sq: "porosia", tr: "sipariş" },
              { id: "hyrja", sq: "hyrja", tr: "giriş" },
              { id: "kati", sq: "kati", tr: "kat" },
              { id: "ne-cilin-kat", sq: "Në cilin kat?", tr: "Kaçıncı kat?" },
              { id: "po-zbres", sq: "Po zbres.", tr: "Aşağı iniyorum." },
              { id: "prit-pak", sq: "Prit pak.", tr: "Biraz bekle.", note: { tr: "Kibar (siz): Pritni pak.", sq: "Me \"ju\": Pritni pak." } },
              { id: "lere-te-dera", sq: "Lëre te dera.", tr: "Kapıya bırak." },
            ],
          },
          {
            slug: "directions",
            title: { tr: "Yol ve taksi", sq: "Rruga dhe taksia" },
            situation: { tr: "Yol sormak, taksiye binmek", sq: "Pyet për rrugën, merr taksi" },
            items: [
              { id: "majtas", sq: "majtas", tr: "sola" },
              { id: "djathtas", sq: "djathtas", tr: "sağa" },
              { id: "drejt", sq: "drejt", tr: "düz" },
              { id: "ndal-ketu", sq: "Ndal këtu.", tr: "Burada dur." },
              { id: "sa-kushton", sq: "Sa kushton?", tr: "Ne kadar?", note: { tr: "Kosova'da çok duyulur: Sa bon?", sq: "Në Kosovë shpesh: Sa bon?" } },
              { id: "aeroporti", sq: "aeroporti", tr: "havalimanı" },
              { id: "adresa", sq: "adresa", tr: "adres" },
            ],
          },
          {
            slug: "shopping",
            title: { tr: "Alışveriş", sq: "Pazari" },
            situation: { tr: "Markette ve fırında", sq: "Në market dhe në furrë" },
            items: [
              { id: "buke", sq: "bukë", tr: "ekmek" },
              { id: "uje", sq: "ujë", tr: "su" },
              { id: "qumesht", sq: "qumësht", tr: "süt" },
              { id: "sa-kushton-kjo", sq: "Sa kushton kjo?", tr: "Bu ne kadar?" },
              { id: "me-kartele", sq: "me kartelë", tr: "kartla" },
              { id: "kesh", sq: "kesh", tr: "nakit" },
              { id: "qese", sq: "qese", tr: "poşet" },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "kosovo-speech",
    title: { tr: "Kosova ağzı", sq: "E folmja e Kosovës" },
    description: { tr: "Priştine'de gerçekten nasıl konuşulur: Kosova kelimeleri ve Türkçeden geçenler.", sq: "Si flitet vërtet në Prishtinë: fjalë kosovare dhe fjalë nga turqishtja." },
    icon: "message",
    units: [
      {
        slug: "like-a-local",
        title: { tr: "Yerli gibi", sq: "Si vendas" },
        isFree: true,
        lessons: [
          {
            slug: "kosovo-words",
            title: { tr: "Kosova kelimeleri", sq: "Fjalë kosovare" },
            situation: { tr: "Kitapta değil, sokakta duyacakların", sq: "Ato që i dëgjon në rrugë, jo në libër" },
            items: [
              { id: "qysh", sq: "qysh", tr: "nasıl", note: { tr: "Standart: si", sq: "Në standard: si" } },
              { id: "cka", sq: "çka", tr: "ne", note: { tr: "Standart: çfarë", sq: "Në standard: çfarë" } },
              { id: "tash", sq: "tash", tr: "şimdi", note: { tr: "Standart: tani", sq: "Në standard: tani" } },
              { id: "kurgjo", sq: "kurgjo", tr: "hiçbir şey", note: { tr: "Standart: asgjë", sq: "Në standard: asgjë" } },
              { id: "shpi", sq: "shpi", tr: "ev", note: { tr: "Standart: shtëpi", sq: "Në standard: shtëpi" } },
              { id: "kerr", sq: "kerr", tr: "araba", note: { tr: "Standart: veturë (Arnavutluk'ta: makinë)", sq: "Në standard: veturë" } },
              { id: "gepek", sq: "gepek", tr: "bagaj", note: { tr: "Almanca \"Gepäck\"ten", sq: "Nga gjermanishtja \"Gepäck\"" } },
            ],
          },
          {
            slug: "turkish-in-albanian",
            title: { tr: "Türkçeden geçenler", sq: "Fjalë nga turqishtja" },
            situation: { tr: "Bunları zaten biliyorsun!", sq: "Këto i di tashmë!" },
            items: [
              { id: "avash", sq: "avash", tr: "yavaş" },
              { id: "zor", sq: "zor", tr: "zor" },
              { id: "boll", sq: "boll", tr: "bol" },
              { id: "belesh", sq: "belesh", tr: "beleş, bedava" },
              { id: "gajle", sq: "gajle", tr: "dert, kaygı" },
              { id: "zaten", sq: "zaten", tr: "zaten" },
              { id: "demek", sq: "demek", tr: "demek ki" },
              { id: "aferim", sq: "aferim", tr: "aferin" },
            ],
          },
          {
            slug: "with-friends",
            title: { tr: "Arkadaş arasında", sq: "Mes shokësh" },
            situation: { tr: "Samimi konuşma", sq: "Bisedë e lirë" },
            items: [
              { id: "cka-ka", sq: "Çka ka?", tr: "Naber?" },
              { id: "qysh-je", sq: "Qysh je?", tr: "Nasılsın?" },
              { id: "shok", sq: "shok", tr: "arkadaş" },
              { id: "vlla", sq: "vlla", tr: "kardeş (samimi hitap)" },
              { id: "ska-gajle", sq: "S'ka gajle.", tr: "Dert değil." },
              { id: "hajde-bre", sq: "Hajde bre!", tr: "Hadi be!" },
              { id: "po-vij-tash", sq: "Po vij tash.", tr: "Şimdi geliyorum.", note: { tr: "Standart: Po vij tani.", sq: "Në standard: Po vij tani." } },
              { id: "krejt-ne-rregull", sq: "Krejt në rregull.", tr: "Her şey yolunda.", note: { tr: "Standart: Gjithçka në rregull.", sq: "Në standard: Gjithçka në rregull." } },
              { id: "ska-lidhje", sq: "S'ka lidhje.", tr: "Fark etmez, önemli değil.", note: { tr: "Standart: Nuk ka rëndësi.", sq: "Në standard: Nuk ka rëndësi." } },
            ],
          },
          {
            slug: "context-words",
            title: { tr: "Bağlama göre anlam", sq: "Kuptimi sipas kontekstit" },
            situation: { tr: "Aynı kelime, farklı anlam: bon ve kah", sq: "E njëjta fjalë, kuptim tjetër: bon dhe kah" },
            items: [
              { id: "cka-po-bon", sq: "Çka po bon?", tr: "Ne yapıyorsun?", note: { tr: "bon = bën. Standart: Çfarë po bën?", sq: "Në standard: Çfarë po bën?" } },
              { id: "a-bon", sq: "A bon?", tr: "Olur mu? / Uyar mı?", note: { tr: "Burada bon = olur, uyar. Standart: A është në rregull?", sq: "Në standard: A është në rregull?" } },
              { id: "a-bon-me-hy", sq: "A bon me hy?", tr: "Girebilir miyim?", note: { tr: "Standart: A mund të hyj?", sq: "Në standard: A mund të hyj?" } },
              { id: "po-bon-ska-problem", sq: "Po bon, s'ka problem.", tr: "Olur, sorun değil.", note: { tr: "Standart: Po, është në rregull.", sq: "Në standard: Po, është në rregull." } },
              { id: "bon-bon", sq: "Bon, bon.", tr: "Tamam, olur.", note: { tr: "Onay cevabı; \"yapıyor\" anlamı yok.", sq: "Pëlqim: \"në rregull\"." } },
              { id: "sa-bon", sq: "Sa bon?", tr: "Ne kadar tutuyor?", note: { tr: "Standart: Sa kushton?", sq: "Në standard: Sa kushton?" } },
              { id: "kah-po-shkon", sq: "Kah po shkon?", tr: "Nereye gidiyorsun?", note: { tr: "Standart: Ku po shkon?", sq: "Në standard: Ku po shkon?" } },
              { id: "jam-kah-vij", sq: "Jam kah vij.", tr: "Geliyorum, yoldayım.", note: { tr: "Standart: Po vij.", sq: "Në standard: Po vij." } },
            ],
          },
          {
            slug: "kosovo-verbs",
            title: { tr: "Kosova'da fiiller", sq: "Foljet në Kosovë" },
            situation: { tr: "\"me + fiil\" ve \"s'po\": Priştine'de günlük kalıplar", sq: "\"me + folje\" dhe \"s'po\": si flitet në Prishtinë" },
            items: [
              { id: "duhet-me-shku", sq: "Duhet me shku.", tr: "Gitmem lazım.", note: { tr: "Kosova'da \"të + fiil\" yerine \"me + fiil\". Standart: Duhet të shkoj.", sq: "Në standard: Duhet të shkoj." } },
              { id: "kam-me-ardhe", sq: "Kam me ardhë.", tr: "Geleceğim.", note: { tr: "Söylenişi: kom me ardhë. Standart: Do të vij.", sq: "Shqiptohet: kom me ardhë. Në standard: Do të vij." } },
              { id: "a-mundesh-me-ndihmu", sq: "A mundesh me m'ndihmu?", tr: "Bana yardım edebilir misin?", note: { tr: "Standart: A mund të më ndihmosh?", sq: "Në standard: A mund të më ndihmosh?" } },
              { id: "spo-di", sq: "S'po di.", tr: "Bilmiyorum.", note: { tr: "Standart: Nuk e di.", sq: "Në standard: Nuk e di." } },
              { id: "spo-kuptoj", sq: "S'po kuptoj.", tr: "Anlamıyorum.", note: { tr: "Standart: Nuk e kuptoj.", sq: "Në standard: Nuk e kuptoj." } },
              { id: "pritem-pak", sq: "Pritëm pak.", tr: "Beni biraz bekle.", note: { tr: "Standart: Më prit pak.", sq: "Në standard: Më prit pak." } },
              { id: "ska-kurgjo", sq: "S'ka kurgjo.", tr: "Bir şey yok, önemli değil.", note: { tr: "Standart: Nuk ka asgjë.", sq: "Në standard: Nuk ka asgjë." } },
            ],
          },
        ],
      },
    ],
  },
];

export type LessonRef = { track: Track; unit: Unit; lesson: Lesson; index: number };

/** Every lesson in learning order, with its track and unit. */
export const lessonList: LessonRef[] = tracks.flatMap((track) =>
  track.units.flatMap((unit) => unit.lessons.map((lesson) => ({ track, unit, lesson, index: 0 }))),
).map((ref, index) => ({ ...ref, index }));

export const lessonBySlug: Record<string, LessonRef> = Object.fromEntries(lessonList.map((ref) => [ref.lesson.slug, ref]));

export const itemById: Record<string, Item> = Object.fromEntries(
  tracks.flatMap((t) => t.units.flatMap((u) => u.lessons.flatMap((l) => l.items.map((i) => [i.id, i])))),
);
