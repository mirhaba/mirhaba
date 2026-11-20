// Quick Talk seed content. Bundled with the app so it works offline from the first visit.
// Later this moves to Supabase (`phrase_categories`, `phrases`, `reply_buttons`) and is
// synced into IndexedDB; the shape here mirrors those tables.
//
// IMPORTANT: every Albanian line must be checked by native Prishtina speakers before launch.

export type Bilingual = { tr: string; sq: string };

export type Reply = Bilingual & { id: string };

export type Phrase = Bilingual & {
  id: string;
  /** Fill-in options. `{slot}` in `tr` / `sq` is replaced by the chosen option. */
  slot?: Bilingual[];
  /** Reply button ids the Kosovan can tap to answer. */
  replies?: string[];
  /** Recorded native audio (public path). Falls back to device TTS when missing. */
  audio?: string;
};

export type Category = {
  slug: string;
  name: Bilingual;
  /** Key into `categoryIcons` (src/components/icons.tsx). Stored as text in `phrase_categories.icon`. */
  icon: string;
  /** Included in the free "everyday basics" offline pack. */
  basic: boolean;
  phrases: Phrase[];
};

export const replies: Record<string, Reply> = Object.fromEntries(
  (
    [
      { id: "yes", sq: "Po", tr: "Evet" },
      { id: "no", sq: "Jo", tr: "Hayır" },
      { id: "wait", sq: "Prit pak", tr: "Biraz bekle" },
      { id: "ok", sq: "Në rregull", tr: "Tamam" },
      { id: "dontUnderstand", sq: "S'po kuptoj", tr: "Anlamıyorum" },
      { id: "comeUp", sq: "Hajde lart", tr: "Yukarı gel" },
      { id: "comingDown", sq: "Po zbres", tr: "Aşağı iniyorum" },
      { id: "leaveAtDoor", sq: "Lëre te dera", tr: "Kapıya bırak" },
      { id: "floor1", sq: "Kati i parë", tr: "1. kat" },
      { id: "floor2", sq: "Kati i dytë", tr: "2. kat" },
      { id: "floor3", sq: "Kati i tretë", tr: "3. kat" },
      { id: "floor4", sq: "Kati i katërt", tr: "4. kat" },
      { id: "today", sq: "Sot", tr: "Bugün" },
      { id: "tomorrow", sq: "Nesër", tr: "Yarın" },
      { id: "card", sq: "Me kartelë", tr: "Kartla" },
      { id: "cash", sq: "Kesh", tr: "Nakit" },
      { id: "left", sq: "Majtas", tr: "Sola" },
      { id: "right", sq: "Djathtas", tr: "Sağa" },
      { id: "straight", sq: "Drejt", tr: "Düz" },
      { id: "thanks", sq: "Faleminderit", tr: "Teşekkürler" },
    ] satisfies Reply[]
  ).map((r) => [r.id, r]),
);

const yesNo = ["yes", "no", "wait", "dontUnderstand"];

export const categories: Category[] = [
  {
    slug: "greetings",
    name: { tr: "Selamlaşma", sq: "Përshëndetje" },
    icon: "hand",
    basic: true,
    phrases: [
      { id: "g1", tr: "Merhaba", sq: "Përshëndetje" },
      { id: "g2", tr: "Selam (samimi)", sq: "Tung" },
      { id: "g3", tr: "Günaydın", sq: "Mirëmëngjes" },
      { id: "g4", tr: "İyi günler", sq: "Mirëdita" },
      { id: "g5", tr: "Teşekkürler", sq: "Faleminderit" },
      { id: "g6", tr: "Özür dilerim", sq: "Më falni" },
      { id: "g7", tr: "Arnavutçam iyi değil.", sq: "Nuk e flas mirë shqipen.", replies: ["ok", "thanks"] },
      { id: "g8", tr: "Türkçe biliyor musunuz?", sq: "A dini turqisht?", replies: ["yes", "no"] },
    ],
  },
  {
    slug: "delivery",
    name: { tr: "Teslimat", sq: "Dërgesa" },
    icon: "package",
    basic: true,
    phrases: [
      { id: "d1", tr: "Merhaba, siparişiniz geldi.", sq: "Përshëndetje, porosia juaj ka ardhur.", replies: ["comingDown", "comeUp", "wait", "leaveAtDoor"] },
      { id: "d2", tr: "Kapıdayım.", sq: "Jam te dera.", replies: ["comingDown", "comeUp", "wait"] },
      {
        id: "d3",
        tr: "{slot} girişindeyim.",
        sq: "Jam te hyrja {slot}.",
        slot: [
          { tr: "A", sq: "A" },
          { tr: "B", sq: "B" },
          { tr: "C", sq: "C" },
        ],
        replies: ["comingDown", "comeUp", "wait"],
      },
      {
        id: "d4",
        tr: "{slot} dakika içinde oradayım.",
        sq: "Për {slot} minuta jam aty.",
        slot: [
          { tr: "5", sq: "5" },
          { tr: "10", sq: "10" },
          { tr: "15", sq: "15" },
        ],
        replies: ["ok", "thanks"],
      },
      { id: "d5", tr: "Kaçıncı kat?", sq: "Në cilin kat?", replies: ["floor1", "floor2", "floor3", "floor4"] },
      { id: "d6", tr: "Kapıyı açar mısınız?", sq: "A mund ta hapni derën?", replies: ["yes", "wait"] },
      { id: "d7", tr: "Siparişi kapıya bırakayım mı?", sq: "Ta lë porosinë te dera?", replies: ["yes", "no"] },
      { id: "d8", tr: "Kartla mı, nakit mi ödeyeceksiniz?", sq: "Paguani me kartelë apo kesh?", replies: ["card", "cash"] },
      { id: "d9", tr: "Adresi bulamıyorum, konum gönderir misiniz?", sq: "Nuk po e gjej adresën, a mund të ma dërgoni lokacionin?", replies: ["yes", "ok"] },
    ],
  },
  {
    slug: "home",
    name: { tr: "Ev ve ev sahibi", sq: "Shtëpia dhe pronari" },
    icon: "house",
    basic: true,
    phrases: [
      { id: "h1", tr: "Evi görebilir miyim?", sq: "A mund ta shoh banesën?", replies: ["yes", "tomorrow", "no"] },
      { id: "h2", tr: "Kira ne kadar?", sq: "Sa është qiraja?" },
      { id: "h3", tr: "Depozito ne kadar?", sq: "Sa është depoziti?" },
      { id: "h4", tr: "Kirayı ne zaman ödeyeyim?", sq: "Kur ta paguaj qiranë?", replies: ["today", "tomorrow"] },
      { id: "h5", tr: "Sözleşme yapabilir miyiz?", sq: "A mund të bëjmë kontratë?", replies: ["yes", "no"] },
      {
        id: "h6",
        tr: "Bir şey bozuldu: {slot}.",
        sq: "Diçka u prish: {slot}.",
        slot: [
          { tr: "su", sq: "uji" },
          { tr: "elektrik", sq: "rryma" },
          { tr: "ısıtma", sq: "ngrohja" },
        ],
        replies: ["today", "tomorrow", "ok"],
      },
      { id: "h7", tr: "Elektrik faturasını kim ödüyor?", sq: "Kush e paguan faturën e rrymës?" },
    ],
  },
  {
    slug: "work",
    name: { tr: "İş", sq: "Puna" },
    icon: "hammer",
    basic: true,
    phrases: [
      { id: "w1", tr: "Bugün kaçta başlıyoruz?", sq: "Në sa fillojmë sot?" },
      { id: "w2", tr: "Ne yapmam gerekiyor?", sq: "Çka duhet të bëj?" },
      { id: "w3", tr: "Anlamadım, tekrar eder misiniz?", sq: "Nuk e kuptova, a mund ta përsëritni?", replies: ["ok"] },
      { id: "w4", tr: "Biraz daha yavaş konuşur musunuz?", sq: "A mund të flisni pak më ngadalë?", replies: ["ok"] },
      { id: "w5", tr: "Bitirdim.", sq: "E përfundova.", replies: ["thanks", "ok"] },
      { id: "w6", tr: "Maaşımı ne zaman alırım?", sq: "Kur e marr rrogën?" },
      { id: "w7", tr: "Bugün iyi hissetmiyorum, gelemiyorum.", sq: "Sot nuk ndihem mirë, nuk mund të vij.", replies: ["ok"] },
    ],
  },
  {
    slug: "doctor",
    name: { tr: "Doktor ve eczane", sq: "Mjeku dhe barnatorja" },
    icon: "stethoscope",
    basic: true,
    phrases: [
      { id: "m1", tr: "Doktora ihtiyacım var.", sq: "Kam nevojë për mjek." },
      { id: "m2", tr: "Burası ağrıyor.", sq: "Më dhemb këtu." },
      {
        id: "m3",
        tr: "{slot} ağrıyor.",
        sq: "Më dhemb {slot}.",
        slot: [
          { tr: "Başım", sq: "koka" },
          { tr: "Karnım", sq: "barku" },
          { tr: "Dişim", sq: "dhëmbi" },
          { tr: "Boğazım", sq: "fyti" },
        ],
      },
      { id: "m4", tr: "Ateşim var.", sq: "Kam temperaturë." },
      { id: "m5", tr: "İlaç alerjim var.", sq: "Kam alergji ndaj barnave." },
      { id: "m6", tr: "Bu ilacı nasıl kullanmalıyım?", sq: "Si duhet ta përdor këtë bar?" },
      { id: "m7", tr: "Reçetesiz alabilir miyim?", sq: "A mund ta marr pa recetë?", replies: yesNo },
      { id: "m8", tr: "Ne kadar ödemem gerekiyor?", sq: "Sa duhet të paguaj?" },
    ],
  },
  {
    slug: "bank",
    name: { tr: "Banka", sq: "Banka" },
    icon: "banknote",
    basic: false,
    phrases: [
      { id: "b1", tr: "Hesap açmak istiyorum.", sq: "Dua të hap një llogari." },
      { id: "b2", tr: "Para göndermek istiyorum.", sq: "Dua të dërgoj para." },
      { id: "b3", tr: "Kartım çalışmıyor.", sq: "Kartela ime nuk po punon." },
      { id: "b4", tr: "Hangi belgeler gerekli?", sq: "Cilat dokumente duhen?" },
      { id: "b5", tr: "Türkçe ya da İngilizce konuşan biri var mı?", sq: "A ka dikush që flet turqisht ose anglisht?", replies: yesNo },
    ],
  },
  {
    slug: "municipality",
    name: { tr: "Belediye ve oturma izni", sq: "Komuna dhe leja e qëndrimit" },
    icon: "landmark",
    basic: false,
    phrases: [
      { id: "r1", tr: "Oturma izni için geldim.", sq: "Kam ardhur për lejen e qëndrimit." },
      { id: "r2", tr: "Hangi belgeler gerekli?", sq: "Cilat dokumente duhen?" },
      { id: "r3", tr: "Sıra numarasını nereden alıyorum?", sq: "Ku merret numri i radhës?" },
      { id: "r4", tr: "Başvurum ne zaman hazır olur?", sq: "Kur do të jetë gati aplikimi im?" },
      { id: "r5", tr: "Nereyi imzalamalıyım?", sq: "Ku duhet ta nënshkruaj?" },
      { id: "r6", tr: "Tercüman getirebilir miyim?", sq: "A mund të sjell një përkthyes?", replies: yesNo },
    ],
  },
  {
    slug: "school",
    name: { tr: "Okul", sq: "Shkolla" },
    icon: "school",
    basic: false,
    phrases: [
      { id: "s1", tr: "Çocuğumu okula kaydettirmek istiyorum.", sq: "Dua ta regjistroj fëmijën në shkollë." },
      { id: "s2", tr: "Ders kaçta bitiyor?", sq: "Në sa mbaron mësimi?" },
      { id: "s3", tr: "Çocuğum bugün gelmeyecek.", sq: "Fëmija im sot nuk do të vijë.", replies: ["ok"] },
      { id: "s4", tr: "Öğretmenle konuşmak istiyorum.", sq: "Dua të flas me mësimdhënësin.", replies: ["today", "tomorrow", "wait"] },
    ],
  },
  {
    slug: "shopping",
    name: { tr: "Alışveriş", sq: "Pazari" },
    icon: "basket",
    basic: true,
    phrases: [
      { id: "p1", tr: "Bu ne kadar?", sq: "Sa kushton kjo?" },
      { id: "p2", tr: "Kartla ödeyebilir miyim?", sq: "A mund të paguaj me kartelë?", replies: ["yes", "no"] },
      {
        id: "p3",
        tr: "{slot} istiyorum.",
        sq: "Dua {slot}.",
        slot: [
          { tr: "Ekmek", sq: "bukë" },
          { tr: "Su", sq: "ujë" },
          { tr: "Süt", sq: "qumësht" },
        ],
      },
      { id: "p4", tr: "Daha ucuzu var mı?", sq: "A keni diçka më të lirë?", replies: ["yes", "no"] },
      { id: "p5", tr: "Poşet alabilir miyim?", sq: "A mund të marr një qese?", replies: ["yes"] },
      { id: "p6", tr: "Fiş alabilir miyim?", sq: "A mund ta marr kuponin?", replies: ["yes"] },
    ],
  },
  {
    slug: "taxi",
    name: { tr: "Taksi", sq: "Taksi" },
    icon: "taxi",
    basic: true,
    phrases: [
      { id: "t1", tr: "Beni bu adrese götürür müsünüz?", sq: "A mund të më çoni në këtë adresë?", replies: ["yes", "no"] },
      { id: "t2", tr: "Ne kadar tutar?", sq: "Sa kushton?" },
      { id: "t3", tr: "Taksimetreyi açar mısınız?", sq: "A mund ta ndizni taksimetrin?", replies: ["yes", "ok"] },
      { id: "t4", tr: "Burada durun, lütfen.", sq: "Ndaleni këtu, ju lutem.", replies: ["ok"] },
      { id: "t5", tr: "Havalimanına, lütfen.", sq: "Në aeroport, ju lutem.", replies: ["ok"] },
      { id: "t6", tr: "Hangi yöne?", sq: "Nga cila anë?", replies: ["left", "right", "straight"] },
    ],
  },
  {
    slug: "emergency",
    name: { tr: "Acil durum", sq: "Urgjenca" },
    icon: "siren",
    basic: true,
    phrases: [
      { id: "e1", tr: "Yardım edin!", sq: "Ndihmë!" },
      { id: "e2", tr: "Ambulans çağırın!", sq: "Thirrni ambulancën!" },
      { id: "e3", tr: "Polis çağırın!", sq: "Thirrni policinë!" },
      { id: "e4", tr: "Bir kaza oldu.", sq: "Ka ndodhur një aksident." },
      { id: "e5", tr: "Kayboldum.", sq: "Kam humbur rrugën." },
      { id: "e6", tr: "Türk vatandaşıyım, lütfen büyükelçiliği arayın.", sq: "Jam shtetas turk, ju lutem thirrni ambasadën." },
    ],
  },
];

export const phraseById: Record<string, { phrase: Phrase; category: Category }> = Object.fromEntries(
  categories.flatMap((category) => category.phrases.map((phrase) => [phrase.id, { phrase, category }])),
);

export function fillSlot(text: string, option?: string): string {
  return option === undefined ? text.replace("{slot}", "…") : text.replace("{slot}", option);
}
