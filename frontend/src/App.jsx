import { useEffect, useMemo, useRef, useState } from "react";
import {
  Binary,
  BookOpen,
  Calendar,
  Check,
  Clock,
  FileText,
  Flag,
  FolderOpen,
  Hash,
  KeyRound,
  Layers,
  Library,
  Lightbulb,
  ListOrdered,
  Lock,
  MapPinned,
  Newspaper,
  Receipt,
  Route,
  Search,
  Shield,
  StickyNote,
  Trophy,
  Type,
  Undo2,
  User,
  X,
} from "lucide-react";
import {
  fetchMe,
  getToken,
  setToken,
  startRemoteSession,
  submitRemoteFlag,
} from "./api.js";
import { connectRealtime, playTone } from "./realtime.js";

const ICON_MAP = {
  Search,
  FileText,
  Route,
  Library,
  MapPinned,
  Receipt,
  StickyNote,
  FolderOpen,
  Calendar,
  ListOrdered,
  KeyRound,
  Undo2,
  Type,
  Binary,
  Hash,
  Newspaper,
  Layers,
};

function hydrateRemoteChallenge(item) {
  return {
    ...item,
    points: item.initialPoints ?? item.points,
    icon: ICON_MAP[item.icon] || Search,
    hint: item.hint || "",
    story: item.story || "",
  };
}

const DEFAULT_NICK = "acemi_hacker";
const START_SCORE = 0;
const STORAGE_KEY = "cyber-detectives-ctf-v3h-nick";
const DEFAULT_DURATION = 3 * 60 * 60 * 1000;
const SESSION_HOURS = 3;
const PARTICIPANTS = 50;
const DECAY = 40;
const ACCESS_CODE = "HSD_FIRAT_2026";
const NICK_MAX = 18;

const HINT_DELAY_MIN = {
  Kolay: 8,
  Orta: 12,
  Zor: 15,
};

const RELEASE_WAVES = [
  {
    at: 0,
    ids: ["osint-1", "crypto-1", "osint-2"],
    label: "Açılış · 3 kolay",
  },
  {
    at: 15,
    ids: ["osint-5", "crypto-5", "osint-6"],
    label: "15. dk · 3 orta",
  },
  {
    at: 45,
    ids: ["osint-9"],
    label: "45. dk · 1 zor",
  },
  {
    at: 60,
    ids: ["crypto-2", "osint-3", "crypto-3"],
    label: "1. saat · 3 kolay",
  },
  {
    at: 75,
    ids: ["crypto-6", "osint-7", "crypto-7"],
    label: "75. dk · 3 orta",
  },
  {
    at: 105,
    ids: ["crypto-10"],
    label: "105. dk · 1 zor",
  },
  {
    at: 120,
    ids: ["osint-4", "crypto-4"],
    label: "2. saat · 2 kolay",
  },
  {
    at: 135,
    ids: ["osint-8", "crypto-8", "crypto-9"],
    label: "135. dk · 3 orta",
  },
  {
    at: 150,
    ids: ["osint-10", "crypto-11"],
    label: "150. dk · 2 zor",
  },
  {
    at: 165,
    ids: ["osint-11", "crypto-12"],
    label: "165. dk · 2 zor",
  },
];

const UNLOCK_AT = Object.fromEntries(
  RELEASE_WAVES.flatMap((wave) => wave.ids.map((id) => [id, wave.at]))
);

const CATEGORIES = {
  osint: {
    title: "OSINT (DİJİTAL İZ SÜRME / ARAŞTIRMA)",
    border: "border-cyan-500",
    text: "text-cyan-400",
    glow: "shadow-[0_0_22px_rgba(34,211,238,0.18)]",
    iconWrap: "border-cyan-500 text-cyan-400",
    button:
      "border-cyan-500 text-cyan-300 hover:bg-cyan-400/15 hover:text-cyan-100 hover:shadow-[0_0_16px_rgba(34,211,238,0.55)]",
    chip: "border-cyan-500/70 bg-cyan-400/10 text-cyan-300",
    line: "bg-cyan-400",
  },
  crypto: {
    title: "CRYPTO (ŞİFRELEME VE ANALİZ)",
    border: "border-purple-500",
    text: "text-purple-400",
    glow: "shadow-[0_0_22px_rgba(168,85,247,0.2)]",
    iconWrap: "border-purple-500 text-purple-400",
    button:
      "border-purple-500 text-purple-300 hover:bg-purple-400/15 hover:text-purple-100 hover:shadow-[0_0_16px_rgba(168,85,247,0.55)]",
    chip: "border-purple-500/70 bg-purple-400/10 text-purple-300",
    line: "bg-purple-400",
  },
};

const DIFFICULTY = {
  Kolay: "border-green-500/70 bg-green-500/10 text-green-400",
  Orta: "border-amber-400/70 bg-amber-400/10 text-amber-300",
  Zor: "border-rose-500/70 bg-rose-500/10 text-rose-400",
};

const CHALLENGES = [
  {
    id: "osint-1",
    category: "osint",
    title: "Gece Vardiyası Notu",
    points: 100,
    minutes: 10,
    difficulty: "Kolay",
    icon: Search,
    description: "Açık arşive düşmüş bir nöbet defterinde durak kodunu bul.",
    story:
      "Şehrin herkese açık arşivinde kısa bir nöbet notu duruyor. Bayrak, notun içindeki favori koddur.\n\nNÖBET DEFTERİ #17\nTarih: 12 Mart\nGörevli: gece_bekcisi\nRota: İskele → Çarşı → Teras\nFavori kod: lamba_alti\nNot: Tabelalar yalan söylemez.\n\nFavori kodu CTF{ } içine yaz.",
    hint: "Favori kod satırını olduğu gibi süslü parantezin içine al.",
  },
  {
    id: "osint-2",
    category: "osint",
    title: "Satır Başları",
    points: 100,
    minutes: 12,
    difficulty: "Kolay",
    icon: FileText,
    description: "Kısa bir duyurunun her satırı bir harf saklıyor.",
    story:
      "Mahalle panosundaki duyuru beş satır. Bayrak, satırların ilk harfleridir. Hepsini küçük yaz.\n\nSis kalktı\nİz sürülür\nYol uzar\nAyna kırık\nHava soğuk",
    hint: "Beş satır, beş harf. Baştan sona birleştir.",
  },
  {
    id: "osint-3",
    category: "osint",
    title: "Gece Seferi",
    points: 120,
    minutes: 12,
    difficulty: "Kolay",
    icon: Route,
    description: "Otobüs çizelgesinde yalnızca gece seferinin kapı kodu lazım.",
    story:
      "Duraktaki çizelge:\n\nSabah 07:10  kapı kodu: gun_01\nÖğle 12:40   kapı kodu: tas_04\nGece 23:15   kapı kodu: kapi_09\nSon 00:05    kapı kodu: son_02\n\nNot: Bayrak, saati 23:15 olan seferin kapı kodudur.",
    hint: "Gece satırındaki kodu CTF{ } içine al.",
  },
  {
    id: "osint-4",
    category: "osint",
    title: "Raf Etiketi",
    points: 120,
    minutes: 15,
    difficulty: "Kolay",
    icon: Library,
    description: "Kütüphane etiketinde sayıları atlayıp kelimeleri birleştir.",
    story:
      "Eski raf etiketi şöyle dizilmiş:\n\nRAF: gece / 14 / kutu / 7 / yedi\n\nKural: Yalnızca harften oluşan parçaları soldan sağa al. Sayıları ve rakamla başlayan parçaları at. Kalanları alt çizgi ile birleştir.",
    hint: "Rakamları at. Kalan kelimeleri soldan sağa alt çizgi ile birleştir.",
  },
  {
    id: "osint-5",
    category: "osint",
    title: "Kayıp Kartpostal",
    points: 200,
    minutes: 18,
    difficulty: "Orta",
    icon: MapPinned,
    description: "Eski bir kartpostaldaki üç parçayı doğru sırayla birleştir.",
    story:
      "Arşivden çıkan kartpostalın arkası:\n\nSatır A — Pulun üstü: IZMIR\nSatır B — İmza: Kedi\nSatır C — Köşeye çizilmiş işaret: _\n\nKenar notu: Harfleri küçült. Sıra pul, işaret, imza. Dışına CTF{ } ekle.",
    hint: "Önce şehir, sonra alt çizgi, sonra rumuz.",
  },
  {
    id: "osint-6",
    category: "osint",
    title: "Menü Fişi",
    points: 220,
    minutes: 20,
    difficulty: "Orta",
    icon: Receipt,
    description: "Fişteki en pahalı tatlı ile en ucuz içeceği yan yana getir.",
    story:
      "Kafe fişi:\n\nçay        içecek   15\nsu         içecek   10\nayran      içecek   18\nkek        tatlı    40\nbaklava    tatlı    70\nkurabiye   tatlı    35\n\nKural: En pahalı tatlının adı, alt çizgi, en ucuz içeceğin adı. Küçük harf.",
    hint: "Tatlılar kendi arasında, içecekler kendi arasında kıyaslanır.",
  },
  {
    id: "osint-7",
    category: "osint",
    title: "Üç Yapışkan",
    points: 250,
    minutes: 25,
    difficulty: "Orta",
    icon: StickyNote,
    description: "Üç notun belirli kelimeleri bir parola oluşturuyor.",
    story:
      "Monitörün kenarında üç yapışkan var. Kapaktaki kural:\n\"1. notun 2. kelimesi + 2. notun 1. kelimesi + 3. notun son kelimesi.\"\n\nNot 1: lamba gece yanar\nNot 2: kedi camda bekler\nNot 3: iz sür teras\n\nKelimelerin arasına alt çizgi koy.",
    hint: "Her nottan kuralın söylediği tek kelimeyi al. Sıra 1, 2, 3.",
  },
  {
    id: "osint-8",
    category: "osint",
    title: "Arşiv Sırası",
    points: 280,
    minutes: 25,
    difficulty: "Orta",
    icon: FolderOpen,
    description: "Dosya adları 1-2-3 diye gider. Okuma sırası başka.",
    story:
      "Açık klasör:\n\nparca1.txt  →  sol\nparca2.txt  →  gunes\nparca3.txt  →  saat\nOKU.txt     →  Sıra: 3, sonra 1, sonra 2. Alt çizgi ile birleştir.\n\nBayrak, bu okuma sırasının sonucudur.",
    hint: "OKU.txt içindeki sıra, dosya adındaki numaradan farklı.",
  },
  {
    id: "osint-9",
    category: "osint",
    title: "Tarih Sırası",
    points: 350,
    minutes: 35,
    difficulty: "Zor",
    icon: Calendar,
    description: "Üç eski gönderiyi tarihe göre diz, sonra istenen alanları seç.",
    story:
      "Üç kamu gönderisi:\n\n07 Ocak — eşya: anahtar, renk: siyah, şehir: izmir\n19 Mart — eşya: harita, renk: mavi, şehir: ankara\n02 Şubat — eşya: pusula, renk: gri, şehir: bursa\n\nSabitlenmiş kural, en altta:\nEn yeni gönderinin şehir alanı, en eskinin eşya alanı, ortadakinin renk alanı.\nKüçük harf. Aralara alt çizgi.",
    hint: "En yeni Mart, en eski Ocak, ortadaki Şubat.",
  },
  {
    id: "osint-10",
    category: "osint",
    title: "Ters Devriye",
    points: 400,
    minutes: 35,
    difficulty: "Zor",
    icon: Route,
    description: "Rota soldan sağa yazılmış. Devriye ters yönde yürümüş.",
    story:
      "Sözlük:\nK1 = liman\nK2 = tepe\nK3 = kopru\n\nDuvar yazısı: K1 → K2 → K3\n\nDipnot: Devriye ters yönde yürür. Yürüdüğü yer adlarını alt çizgi ile birleştir.",
    hint: "Sıra K3, K2, K1 olur.",
  },
  {
    id: "osint-11",
    category: "osint",
    title: "Satır Avı",
    points: 450,
    minutes: 40,
    difficulty: "Zor",
    icon: ListOrdered,
    description: "On iki satırlık notta yalnızca belirli satırların ilk kelimesi sayılır.",
    story:
      "Numara yazılmamış. Satırları kendin say. Kural: numarası 3'ün katı olan satırların İLK kelimesini al. Küçük harf, alt çizgi ile birleştir.\n\nSis limanı örttü.\nLamba hâlâ sıcaktı.\nGece vardiyası başladı.\nEski kapı aralıktı.\nRüzgar tabelayı dövdü.\nKapi kodu defterde yok.\nCam buğusu silindi.\nIzgara soğumuştu.\nIz taşların arasındaydı.\nMor ışık yandı.\nSon otobüs kaçtı.\nSon satır bilerek tekrar.",
    hint: "3'ün katı olan satırlar. Numara yok; ilk satır 1 kabul edilir. Her birinin ilk kelimesini al.",
  },
  {
    id: "crypto-1",
    category: "crypto",
    title: "On Üç Adım",
    points: 100,
    minutes: 12,
    difficulty: "Kolay",
    icon: KeyRound,
    description: "Her harf alfabede 13 adım kaymış. Kaydırmayı geri al.",
    story:
      "Ele geçen şerit:\n\nCTF{ebg13_xbynl}\n\nHer harf 13 adım ileri gitmiş. Bu yöntemin adı ROT13. Rakam, alt çizgi ve parantez yerinde kalır.\n\nÖrnek: N harfi 13 adım geri gelince A olur. Aynı kaydırma ikinci kez uygulanınca metin eski haline döner.",
    hint: "Parantezin içindeki harflere bir kez daha ROT13 uygula.",
  },
  {
    id: "crypto-2",
    category: "crypto",
    title: "Ters Şerit",
    points: 100,
    minutes: 10,
    difficulty: "Kolay",
    icon: Undo2,
    description: "Şerit sondan başa yazılmış. Tamamını çevir.",
    story:
      "Kameraya ters düşmüş bir şerit:\n\n}izay_sret{FTC\n\nTüm satırı soldan sağa düz çevir. Çıkan metin bayrağın kendisidir.",
    hint: "Son karakter yeni ilk karakter olsun. Parantezler de döner.",
  },
  {
    id: "crypto-3",
    category: "crypto",
    title: "Üç Kutu",
    points: 150,
    minutes: 15,
    difficulty: "Kolay",
    icon: Type,
    description: "Her harf alfabede 3 adım ileri kaymış.",
    story:
      "Kutu kapağında şu yazıyor:\n\nCTF{vhcdu_xf}\n\nNot: Sezar kaydırması, artı 3. Çözerken her harfi 3 adım geri al. a, b, c sırasını kullan. Rakam yok. Alt çizgi yerinde kalır.\n\nÖrnek: d harfi 3 geri gelince a olur.",
    hint: "v→s, h→e diye devam et. Parantezin içi küçük harftir.",
  },
  {
    id: "crypto-4",
    category: "crypto",
    title: "Gizli Mektup",
    points: 150,
    minutes: 15,
    difficulty: "Kolay",
    icon: Binary,
    description: "Mektup Base64 ile kodlanmış. Çözünce bayrağın tamamı çıkar.",
    story:
      "Zarfta tek satır:\n\nQ1RGe2dpemxpX21la3R1cH0=\n\nBu bir Base64 metnidir. Base64, yazıyı harf ve rakamlardan oluşan bir koda çevirir. Çözülen metin bayrağın tamamıdır.\n\nKontrol: Doğru çözüm CTF{ ile başlar.",
    hint: "Satırı bir Base64 çözücüye yapıştır. Çıktıyı olduğu gibi gönder.",
  },
  {
    id: "crypto-5",
    category: "crypto",
    title: "Onaltılık Izgara",
    points: 200,
    minutes: 20,
    difficulty: "Orta",
    icon: Hash,
    description: "Her bayt iki onaltılık karakter. Boşluklar yalnızca okuma kolaylığı.",
    story:
      "Izgaradaki kod:\n\n43 54 46 7b 68 65 78 5f 69 73 69 6b 7d\n\nHer çift, bir ASCII karakterin hex karşılığıdır. Boşlukları silip çöz. Çıktı bayrağın tamamıdır.\n\nBaşlangıç: 43 = C, 54 = T, 46 = F.",
    hint: "7b süslü parantez açar, 7d kapatır, 5f alt çizgidir.",
  },
  {
    id: "crypto-6",
    category: "crypto",
    title: "Kısa Sinyal",
    points: 250,
    minutes: 35,
    difficulty: "Orta",
    icon: Newspaper,
    description: "Nokta ve çizgiler harfe dönüşür. Eğik çizgi alt çizgidir.",
    story:
      "Telsiz kaydı:\n\n-- --- .-. ... . / --. . -.-. .\n\nHarfler boşlukla ayrılır. / işareti alt çizgidir. Çözülen kelimeyi CTF{ } içine yaz.\n\nAlfabe:\nA .-     B -...   C -.-.   D -..\nE .      F ..-.   G --.    H ....\nI ..     J .---   K -.-    L .-..\nM --     N -.     O ---    P .--.\nQ --.-   R .-.    S ...    T -\nU ..-    V ...-   W .--    X -..-\nY -.--   Z --..",
    hint: "İlk beş işaret morse kelimesini verir. Çizgiden sonraki dört harf ikinci kelimedir.",
  },
  {
    id: "crypto-7",
    category: "crypto",
    title: "Ters Alfabe",
    points: 220,
    minutes: 25,
    difficulty: "Orta",
    icon: Type,
    description: "A ile Z yer değiştirmiş. Bu yöntemin adı Atbash.",
    story:
      "Ayna notu:\n\nCTF{zgyzhs_tvxv}\n\nAtbash'ta a=z, b=y, c=x diye devam eder. Aynı işlem geri dönüştür. Alt çizgi ve parantez durur.\n\nÖrnek: z harfi a olur.",
    hint: "İçerideki ilk harf z ise düz metinde a'dır.",
  },
  {
    id: "crypto-8",
    category: "crypto",
    title: "Sekiz Bit",
    points: 280,
    minutes: 30,
    difficulty: "Orta",
    icon: Binary,
    description: "Her sekiz bit bir karakter. Gruplar zaten ayrılmış.",
    story:
      "Şerit:\n\n01000011 01010100 01000110 01111011 01100010 01101001 01110100 01011111 01101001 01111010 01101001 01111101\n\nHer grup bir ASCII karakterdir. Hepsini sırayla çevir. Çıktı bayrağın tamamıdır.\n\nÖrnek: 01000011 = C.",
    hint: "İlk üç grup C, T, F olur. 01111011 açılan parantezdir.",
  },
  {
    id: "crypto-9",
    category: "crypto",
    title: "Sayıdan Harf",
    points: 250,
    minutes: 25,
    difficulty: "Orta",
    icon: Hash,
    description: "A=1, B=2 diye gider. Eğik çizgi alt çizgidir.",
    story:
      "Levhadaki sayılar:\n\n18 1 4 1 18 / 11 15 4\n\nA=1, B=2, ... Z=26. Eğik çizgi alt çizgi yerine duruyor. Harfleri birleştirip CTF{ } içine al.",
    hint: "18 = R. Aynı sayı kelimenin sonunda bir kez daha var.",
  },
  {
    id: "crypto-10",
    category: "crypto",
    title: "Dönen Anahtar",
    points: 400,
    minutes: 40,
    difficulty: "Zor",
    icon: KeyRound,
    description: "Anahtar GECE. Her harf, anahtardaki sıradaki harf kadar kaymış.",
    story:
      "Şifreli iç metin:\n\nCTF{bmiititi_miei}\n\nYöntem Vigenère. Anahtar: GECE\nG=6, E=4, C=2, E=4. Anahtar harf harf döner. Alt çizgi anahtarı ilerletmez; bir sonraki harfte kaldığı yerden devam eder.\n\nÇözerken her harfi, o adımdaki anahtar kadar GERİ al.\nÖrnek: anahtar G ise 6 geri.",
    hint: "İlk harf b, anahtar G. 6 geri gidince v olur. Sonra E, C, E, G diye döner.",
  },
  {
    id: "crypto-11",
    category: "crypto",
    title: "İki Katman",
    points: 450,
    minutes: 35,
    difficulty: "Zor",
    icon: Layers,
    description: "Dış katman Base64. İçeride bir kez daha kaydırma var.",
    story:
      "Dış zarf:\n\nQ1RGe3Z4dl94bmd6bmF9\n\nÖnce Base64 çöz. Çıkan metin CTF{ } biçimindedir ama içindeki harfler 13 adım kaymıştır. İkinci adım ROT13'tür. Rakam yok. Alt çizgi yerinde kalır.",
    hint: "Base64 sonrası iç metin vxv_xngzna gibi görünür. Ona ROT13 uygula.",
  },
  {
    id: "crypto-12",
    category: "crypto",
    title: "Üç Adım",
    points: 480,
    minutes: 45,
    difficulty: "Zor",
    icon: Layers,
    description: "Dışarıdan içeri: hex, ters çevir, bir adım geri.",
    story:
      "Dış katman hex. Boşluklar ayraçtır:\n\n7d 6e 6a 65 62 5f 64 76 7b 46 54 43\n\nSıra şöyle:\n1. Hex'i ASCII metne çevir.\n2. O metnin tamamını ters çevir.\n3. Harfleri 1 adım geri al. Parantez ve alt çizgi yerinde kalır.\n\nSonuç bayrağın kendisidir.",
    hint: "Hex çözülünce metin } ile başlar. Ters çevirince CTF{ görürsün. Son adımda v bir geri gidince u olur.",
  },
];

const NAV = [
  { id: "challenges", label: "Görevler" },
  { id: "leaderboard", label: "Liderlik Tablosu" },
  { id: "howto", label: "Nasıl Oynanır?" },
];

function getLevel(score) {
  if (score >= 5200) return 6;
  if (score >= 4000) return 5;
  if (score >= 2800) return 4;
  if (score >= 1800) return 3;
  if (score >= 1000) return 2;
  return 1;
}

function minPointsFor(initial) {
  return Math.max(50, Math.round(initial * 0.2));
}

function dynamicPoints(initial, solves) {
  const minimum = minPointsFor(initial);
  if (solves <= 0) return initial;
  const value =
    ((minimum - initial) / (DECAY * DECAY)) * (solves * solves) + initial;
  return Math.max(minimum, Math.ceil(value));
}

function hashId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function rivalSolvesFor(challenge, elapsedMs, durationMs) {
  const targets = { Kolay: 36, Orta: 20, Zor: 8 };
  const jitter = (hashId(challenge.id) % 5) - 2;
  const target = Math.max(
    0,
    Math.min(PARTICIPANTS - 1, (targets[challenge.difficulty] ?? 16) + jitter)
  );
  const progress = durationMs > 0 ? Math.min(1, Math.max(0, elapsedMs / durationMs)) : 1;
  const ease =
    challenge.difficulty === "Zor"
      ? Math.pow(progress, 1.35)
      : challenge.difficulty === "Orta"
        ? Math.pow(progress, 1.05)
        : Math.pow(progress, 0.72);
  return Math.min(target, Math.floor(target * ease));
}

function scoringMeta(challenge, elapsedMs, durationMs, solved, awardedPoints) {
  const rivals = rivalSolvesFor(challenge, elapsedMs, durationMs);
  const solves = rivals + (solved ? 1 : 0);
  const current = dynamicPoints(challenge.points, solves);
  const payout = solved
    ? awardedPoints ?? dynamicPoints(challenge.points, Math.max(0, solves - 1))
    : dynamicPoints(challenge.points, rivals);
  return {
    rivals,
    solves,
    current,
    payout,
    initial: challenge.points,
    minimum: minPointsFor(challenge.points),
  };
}

function normalizeAccessCode(value) {
  return value
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replaceAll("İ", "I")
    .replaceAll("ı", "I");
}

function isValidAccessCode(value) {
  return normalizeAccessCode(value) === normalizeAccessCode(ACCESS_CODE);
}

function sanitizeNick(value) {
  return value.trim().replace(/\s+/g, "_").slice(0, NICK_MAX);
}

function isValidNick(value) {
  const nick = sanitizeNick(value);
  return /^[A-Za-z0-9ÇĞİÖŞÜçğıöşü_]{3,18}$/.test(nick);
}

function readSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    const sessionArmed = Boolean(parsed.sessionArmed && parsed.startedAt);
    return {
      sessionArmed,
      startedAt: sessionArmed ? parsed.startedAt : null,
      nick:
        typeof parsed.nick === "string" && parsed.nick
          ? sanitizeNick(parsed.nick)
          : DEFAULT_NICK,
      durationMs:
        typeof parsed.durationMs === "number" ? parsed.durationMs : DEFAULT_DURATION,
      score: typeof parsed.score === "number" ? parsed.score : START_SCORE,
      solvedIds: Array.isArray(parsed.solvedIds) ? parsed.solvedIds : [],
      awarded:
        parsed.awarded && typeof parsed.awarded === "object" ? parsed.awarded : {},
      hints: parsed.hints && typeof parsed.hints === "object" ? parsed.hints : {},
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
    };
  } catch {
    return null;
  }
}

function formatClock(ms) {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function clockTone(remaining, closed) {
  if (closed || remaining < 5 * 60 * 1000) return "border-rose-500 text-rose-300";
  if (remaining < 30 * 60 * 1000) return "border-amber-400 text-amber-300";
  return "border-green-500/70 text-green-400";
}

function unlockMinuteFor(id) {
  return UNLOCK_AT[id] ?? 0;
}

function isChallengeOpen(id, elapsedMs) {
  return elapsedMs >= unlockMinuteFor(id) * 60 * 1000;
}

function hintDelayFor(challenge) {
  return HINT_DELAY_MIN[challenge.difficulty] ?? 10;
}

function isHintOpen(challenge, elapsedMs) {
  const readyAt =
    (unlockMinuteFor(challenge.id) + hintDelayFor(challenge)) * 60 * 1000;
  return elapsedMs >= readyAt;
}

function msUntil(targetMs, elapsedMs) {
  return Math.max(0, targetMs - elapsedMs);
}

function formatCountdown(ms) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function nextWave(elapsedMs) {
  return RELEASE_WAVES.find((wave) => elapsedMs < wave.at * 60 * 1000) ?? null;
}

function currentWave(elapsedMs) {
  let latest = RELEASE_WAVES[0];
  for (const wave of RELEASE_WAVES) {
    if (elapsedMs >= wave.at * 60 * 1000) latest = wave;
  }
  return latest;
}

function formatRecentWhen(when) {
  const ts = Number(when);
  if (!Number.isFinite(ts) || ts <= 0) return "az önce";
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return "az önce";
  if (sec < 3600) return `${Math.floor(sec / 60)} dk`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} sa`;
  return `${Math.floor(sec / 86400)} gün`;
}

function mapLeaderboard(rows, currentNick) {
  return (rows || []).map((row) => ({
    name: row.nick || row.name,
    score: row.score,
    solved: row.solved ?? 0,
    level: row.level,
    isUser: (row.nick || row.name) === currentNick,
  }));
}

export default function App() {
  const stored = useRef(readSession());
  const [sessionArmed, setSessionArmed] = useState(
    () => Boolean(stored.current?.sessionArmed)
  );
  const [nick, setNick] = useState(
    () => stored.current?.nick ?? DEFAULT_NICK
  );
  const [view, setView] = useState(() =>
    stored.current?.sessionArmed ? "challenges" : "howto"
  );
  const [startedAt, setStartedAt] = useState(() => stored.current?.startedAt ?? null);
  const [durationMs, setDurationMs] = useState(
    () => stored.current?.durationMs ?? DEFAULT_DURATION
  );
  const [score, setScore] = useState(() =>
    stored.current?.sessionArmed ? stored.current.score : START_SCORE
  );
  const [solvedIds, setSolvedIds] = useState(() =>
    stored.current?.sessionArmed ? stored.current.solvedIds : []
  );
  const [awarded, setAwarded] = useState(() =>
    stored.current?.sessionArmed ? stored.current.awarded : {}
  );
  const [hints, setHints] = useState(() =>
    stored.current?.sessionArmed ? stored.current.hints : {}
  );
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState("");
  const [flagError, setFlagError] = useState("");
  const [recent, setRecent] = useState([]);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState("Tümü");
  const [remoteCatalog, setRemoteCatalog] = useState([]);
  const [remoteWaves, setRemoteWaves] = useState(null);
  const [remoteBoard, setRemoteBoard] = useState([]);
  const [frozen, setFrozen] = useState(false);
  const [eventStarted, setEventStarted] = useState(false);
  const [lobbyCount, setLobbyCount] = useState(0);
  const [serverElapsedMs, setServerElapsedMs] = useState(null);
  const [serverRemainingMs, setServerRemainingMs] = useState(null);
  const [announcement, setAnnouncement] = useState(null);
  const [connection, setConnection] = useState("online");
  const [profile, setProfile] = useState({
    solvedCount: 0,
    byCategory: { osint: 0, crypto: 0 },
    totalEarned: 0,
  });
  const submitLock = useRef(false);
  const announcedWave = useRef(null);
  const wasWaiting = useRef(false);
  const warnedLowTime = useRef(false);

  const catalog = remoteCatalog.length > 0 ? remoteCatalog : CHALLENGES;
  const waves = remoteWaves?.length ? remoteWaves : RELEASE_WAVES;
  const active = catalog.find((item) => item.id === activeId) ?? null;
  const level = getLevel(score);
  const board = useMemo(() => {
    if (remoteBoard.length) return remoteBoard;
    if (!sessionArmed) return [];
    return [
      {
        name: nick,
        score,
        solved: solvedIds.length,
        isUser: true,
      },
    ];
  }, [remoteBoard, sessionArmed, nick, score, solvedIds.length]);
  const inLobby = sessionArmed && !eventStarted;
  const elapsed =
    !eventStarted
      ? 0
      : frozen && serverElapsedMs != null
        ? serverElapsedMs
        : sessionArmed && startedAt
          ? Math.max(0, now - startedAt)
          : 0;
  const playElapsed = Math.min(elapsed, durationMs);
  const remaining =
    !eventStarted
      ? durationMs
      : frozen && serverRemainingMs != null
        ? serverRemainingMs
        : sessionArmed && startedAt
          ? Math.max(0, startedAt + durationMs - now)
          : durationMs;
  const closed = sessionArmed && eventStarted && remaining === 0;
  const clock = !sessionArmed || inLobby
    ? formatClock(durationMs)
    : closed
      ? "00:00:00"
      : formatClock(remaining);
  const feed = recent.slice(0, 5);
  const openChallenges = useMemo(
    () =>
      sessionArmed && eventStarted
        ? catalog.filter((item) =>
            typeof item.open === "boolean"
              ? item.open
              : isChallengeOpen(item.id, playElapsed)
          )
        : [],
    [sessionArmed, eventStarted, playElapsed, catalog]
  );
  const upcoming =
    sessionArmed && eventStarted
      ? waves.find((wave) => playElapsed < wave.at * 60 * 1000) || null
      : waves[0];
  const waveNow =
    sessionArmed && eventStarted
      ? (() => {
          let latest = waves[0];
          for (const wave of waves) {
            if (playElapsed >= wave.at * 60 * 1000) latest = wave;
          }
          return latest;
        })()
      : {
          at: -1,
          label: inLobby ? "Admin onayı bekleniyor" : "Kod bekleniyor",
          ids: [],
        };
  const scoreboard = useMemo(() => {
    const map = {};
    for (const challenge of catalog) {
      map[challenge.id] = scoringMeta(
        challenge,
        playElapsed,
        durationMs,
        solvedIds.includes(challenge.id),
        awarded[challenge.id]
      );
      if (typeof challenge.points === "number" && challenge.solves != null) {
        map[challenge.id] = {
          ...map[challenge.id],
          current: challenge.points,
          payout: awarded[challenge.id] ?? challenge.points,
          solves: challenge.solves ?? map[challenge.id].solves,
          initial: challenge.initialPoints ?? challenge.points,
        };
      }
    }
    return map;
  }, [playElapsed, durationMs, solvedIds, awarded, catalog]);
  const activeMeta = active ? scoreboard[active.id] : null;
  const activeHintReady = active
    ? typeof active.hintReady === "boolean"
      ? active.hintReady
      : isHintOpen(active, playElapsed)
    : false;

  function applyRemoteState(me) {
    const live = Boolean(me.event?.started);
    // Sadece lobi → oyun anında görevlere geç; howto'da okurken zorla atma
    if (wasWaiting.current && live) {
      setToast("Oyun başladı · ilk dalga açıldı");
      announcedWave.current = 0;
      setView((current) => (current === "lobby" ? "challenges" : current));
    }
    wasWaiting.current = !live;
    setNick(me.nick);
    setScore(me.score);
    setSolvedIds(me.solvedIds || []);
    setAwarded(me.awarded || {});
    setStartedAt(me.event.startedAt);
    setDurationMs(me.event.durationMs || DEFAULT_DURATION);
    setEventStarted(live);
    setLobbyCount(me.event.playerCount || 0);
    setFrozen(Boolean(me.event.frozen));
    setServerElapsedMs(
      typeof me.event.elapsedMs === "number" ? me.event.elapsedMs : null
    );
    setServerRemainingMs(
      typeof me.event.remainingMs === "number" ? me.event.remainingMs : null
    );
    setRemoteCatalog((me.challenges || []).map(hydrateRemoteChallenge));
    setRemoteWaves(me.event.waves || null);
    setRemoteBoard(mapLeaderboard(me.leaderboard, me.nick));
    if (me.profile) setProfile(me.profile);
    if (me.announcement || me.event?.announcement) {
      setAnnouncement(me.announcement || me.event.announcement);
    }
    setConnection("online");
    if (Array.isArray(me.recent)) {
      setRecent(
        me.recent.slice(0, 8).map((row, index) => ({
          id: `remote-${row.when}-${row.nick}-${index}`,
          user: row.nick,
          title: row.title,
          points: row.points,
          when: formatRecentWhen(row.when),
          isUser: row.nick === me.nick,
        }))
      );
    }
  }

  useEffect(() => {
    if (!activeId) return undefined;
    if (!isChallengeOpen(activeId, playElapsed)) {
      setActiveId(null);
      return undefined;
    }
    const onKey = (event) => {
      if (event.key === "Escape") setActiveId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, playElapsed]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token || sessionArmed) return undefined;
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        setSessionArmed(true);
        applyRemoteState(me);
        setView(me.event?.started ? "challenges" : "lobby");
      })
      .catch(() => {
        setToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionArmed]);

  useEffect(() => {
    if (!sessionArmed || !getToken()) return undefined;
    let cancelled = false;
    const sync = () => {
      fetchMe()
        .then((me) => {
          if (!cancelled) applyRemoteState(me);
        })
        .catch((error) => {
          if (cancelled) return;
          if (error.code === "OFFLINE") {
            setConnection("offline");
            return;
          }
          if (error.status === 401 || error.status === 403) {
            setToken(null);
            setSessionArmed(false);
            setEventStarted(false);
            setView("howto");
            setToast("Oturum geçersiz · yeniden giriş yap");
          }
        });
    };
    sync();
    const timer = setInterval(sync, inLobby ? 2500 : 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionArmed, inLobby]);

  useEffect(() => {
    if (!sessionArmed) return undefined;
    return connectRealtime({
      onStatus: (status) => setConnection(status === "online" ? "online" : "offline"),
      onMessage: (msg) => {
        if (msg.type === "announce" && msg.announcement) {
          setAnnouncement(msg.announcement);
          setToast(msg.announcement.text);
          playTone("wave");
        }
        if (msg.type === "event_start") {
          fetchMe().then(applyRemoteState).catch(() => {});
          playTone("wave");
        }
        if (msg.type === "wave" || msg.type === "unlock") {
          fetchMe().then(applyRemoteState).catch(() => {});
          playTone("wave");
          setToast(msg.wave?.label || "Yeni sorular açıldı");
        }
        if (msg.type === "solve") {
          setRecent((current) =>
            [
              {
                id: `ws-${msg.at}-${msg.nick}`,
                user: msg.nick,
                title: msg.title,
                points: msg.points,
                when: "az önce",
                isUser: msg.nick === nick,
              },
              ...current,
            ].slice(0, 8)
          );
          if (Array.isArray(msg.board) || msg.type === "solve") {
            fetchMe().then(applyRemoteState).catch(() => {});
          }
        }
        if (msg.type === "leaderboard" && Array.isArray(msg.board)) {
          setRemoteBoard(mapLeaderboard(msg.board, nick));
        }
        if (msg.type === "kick" && msg.nick === nick) {
          setToken(null);
          setSessionArmed(false);
          setEventStarted(false);
          setToast("Admin seni çıkardı.");
          playTone("warn");
        }
        if (msg.type === "lobby" || msg.type === "wipe") {
          fetchMe().then(applyRemoteState).catch(() => {});
        }
        if (msg.type === "event") {
          fetchMe().then(applyRemoteState).catch(() => {});
        }
      },
    });
  }, [sessionArmed, nick]);

  useEffect(() => {
    if (!sessionArmed || !eventStarted) return;
    if (announcedWave.current === null) {
      announcedWave.current = waveNow.at;
      return;
    }
    if (waveNow.at !== announcedWave.current && waveNow.at > 0) {
      announcedWave.current = waveNow.at;
      setToast(`Yeni dalga açıldı · ${waveNow.label}`);
      playTone("wave");
    }
  }, [sessionArmed, eventStarted, waveNow]);

  useEffect(() => {
    if (!eventStarted || closed) return;
    if (remaining <= 5 * 60 * 1000 && remaining > 0 && !warnedLowTime.current) {
      warnedLowTime.current = true;
      setToast("Son 5 dakika!");
      playTone("warn");
    }
    if (remaining > 5 * 60 * 1000) warnedLowTime.current = false;
  }, [eventStarted, closed, remaining]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        sessionArmed,
        startedAt,
        nick,
        durationMs,
        score,
        solvedIds,
        awarded,
        hints,
        recent,
      })
    );
  }, [
    sessionArmed,
    startedAt,
    nick,
    durationMs,
    score,
    solvedIds,
    awarded,
    hints,
    recent,
  ]);

  function openChallenge(id) {
    if (!sessionArmed || !eventStarted || !isChallengeOpen(id, playElapsed)) return;
    submitLock.current = false;
    setDraft("");
    setFlagError("");
    setActiveId(id);
  }

  function toggleHint(id) {
    const challenge = catalog.find((item) => item.id === id);
    const ready =
      typeof challenge?.hintReady === "boolean"
        ? challenge.hintReady
        : challenge && isHintOpen(challenge, playElapsed);
    if (!sessionArmed || !eventStarted || !challenge || !ready) return;
    setHints((current) => ({ ...current, [id]: !current[id] }));
  }

  function changeView(next) {
    if (!sessionArmed && next !== "howto") {
      setToast("Önce başlangıç kodu ile oturumu aç.");
      setView("howto");
      setActiveId(null);
      return;
    }
    if (sessionArmed && !eventStarted && (next === "challenges" || next === "leaderboard")) {
      setToast("Admin oyunu başlatana kadar lobidesin.");
      setView("lobby");
      setActiveId(null);
      return;
    }
    setView(next);
    setActiveId(null);
  }

  async function startSession({ code, nick: nickInput }) {
    if (sessionArmed) {
      return { ok: false, error: "Oturum daha önce başlatıldı. Yeniden açılamaz." };
    }
    const cleanNick = sanitizeNick(nickInput || "");
    if (!isValidNick(cleanNick)) {
      return {
        ok: false,
        error: "Rumuz 3-18 karakter olsun. Harf, rakam ve _ kullanılabilir.",
      };
    }
    if (!isValidAccessCode(code)) {
      return { ok: false, error: "Kod hatalı. Tekrar dene." };
    }

    try {
      const remote = await startRemoteSession({ nick: cleanNick, code });
      setToken(remote.token);
      submitLock.current = false;
      setSessionArmed(true);
      setHints({});
      setDraft("");
      setFlagError("");
      setActiveId(null);
      setFilter("Tümü");
      announcedWave.current = 0;
      wasWaiting.current = !remote.started;
      const me = await fetchMe();
      applyRemoteState(me);
      setView(me.event?.started ? "challenges" : "lobby");
      setToast(remote.message || `${remote.nick} · giriş yapıldı`);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error.message || "Backend'e bağlanılamadı. Sunucu açık mı?",
      };
    }
  }

  async function submitFlag(event) {
    event.preventDefault();
    if (!sessionArmed || !eventStarted) {
      setFlagError("Oyun henüz başlamadı. Admin onayı bekleniyor.");
      return;
    }
    if (!active || submitLock.current || solvedIds.includes(active.id)) return;
    if (closed) {
      setFlagError("Süre doldu. Bu oturumda yeni bayrak kabul edilmiyor.");
      return;
    }

    const value = draft.trim();
    if (!value) {
      setFlagError("Önce bir bayrak yaz.");
      return;
    }

    submitLock.current = true;
    try {
      const result = await submitRemoteFlag({
        challengeId: active.id,
        flag: value,
      });
      const payout = result.payout;
      setScore(result.score);
      setAwarded((current) => ({ ...current, [active.id]: payout }));
      setSolvedIds((current) =>
        current.includes(active.id) ? current : [...current, active.id]
      );
      setRemoteBoard((current) =>
        mapLeaderboard(
          [
            ...current
              .filter((row) => !row.isUser)
              .map((row) => ({
                nick: row.name,
                score: row.score,
                solved: row.solved,
                level: row.level,
              })),
            {
              nick,
              score: result.score,
              solved: solvedIds.includes(active.id)
                ? solvedIds.length
                : solvedIds.length + 1,
              level: getLevel(result.score),
            },
          ].sort((a, b) => b.score - a.score || a.nick.localeCompare(b.nick)),
          nick
        )
      );
      setRecent((current) =>
        [
          {
            id: crypto.randomUUID(),
            user: nick,
            title: active.title,
            points: payout,
            when: "az önce",
            isUser: true,
          },
          ...current,
        ].slice(0, 8)
      );
      if (result.profile) setProfile(result.profile);
      setToast(`+${payout} puan · ${active.title}`);
      playTone("ok");
      setDraft("");
      setFlagError("");
      setActiveId(null);
    } catch (error) {
      setFlagError(error.message || "Bayrak gönderilemedi.");
      if (error.code === "OFFLINE") setConnection("offline");
    } finally {
      submitLock.current = false;
    }
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(34,211,238,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.045)_1px,transparent_1px)] bg-[size:52px_52px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_36%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.08),transparent_28%)]" />

      <div className="relative">
        <Navbar
          view={view}
          onNavigate={changeView}
          nick={nick}
          score={score}
          level={level}
          clock={clock}
          closed={closed}
          sessionArmed={sessionArmed}
          eventStarted={eventStarted}
          connection={connection}
          tone={
            !sessionArmed || inLobby
              ? "border-amber-400 text-amber-300"
              : clockTone(remaining, closed)
          }
        />

        {announcement?.text && sessionArmed && (
          <div className="border-b border-amber-400/40 bg-amber-400/10 px-4 py-2 text-center font-mono text-xs text-amber-100">
            DUYURU · {announcement.text}
          </div>
        )}

        {sessionArmed && connection === "offline" && (
          <div className="border-b border-rose-500/50 bg-rose-500/15 px-4 py-2 text-center font-mono text-xs text-rose-200">
            Sunucuya ulaşılamıyor — otomatik yeniden deneniyor…
          </div>
        )}

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {sessionArmed && !eventStarted && (
            <WaitingRoom nick={nick} lobbyCount={lobbyCount} />
          )}
          {sessionArmed &&
            eventStarted &&
            (view === "challenges" || view === "lobby") && (
            <ChallengeBoard
              openChallenges={openChallenges}
              totalCount={catalog.length}
              solvedIds={solvedIds}
              scoreboard={scoreboard}
              hints={hints}
              onToggleHint={toggleHint}
              onOpen={openChallenge}
              recent={feed}
              board={board}
              profile={profile}
              filter={filter}
              onFilter={setFilter}
              closed={closed}
              clock={clock}
              durationMs={durationMs}
              elapsed={playElapsed}
              upcoming={upcoming}
              waveNow={waveNow}
            />
          )}
          {view === "leaderboard" && sessionArmed && eventStarted && (
            <LeaderboardPage board={board} />
          )}
          {view === "howto" && !inLobby && (
            <HowToPage
              sessionArmed={sessionArmed}
              eventStarted={eventStarted}
              onGoChallenges={() => changeView("challenges")}
              onStartSession={startSession}
            />
          )}
        </main>
      </div>

      {active && activeMeta && (
        <SolveModal
          challenge={active}
          meta={activeMeta}
          solved={solvedIds.includes(active.id)}
          closed={closed}
          hintReady={activeHintReady}
          hintRemaining={msUntil(
            (unlockMinuteFor(active.id) + hintDelayFor(active)) * 60 * 1000,
            playElapsed
          )}
          hintOpen={Boolean(hints[active.id]) && activeHintReady}
          draft={draft}
          flagError={flagError}
          onDraft={setDraft}
          onClearError={() => setFlagError("")}
          onToggleHint={() => toggleHint(active.id)}
          onClose={() => setActiveId(null)}
          onSubmit={submitFlag}
        />
      )}

      {toast && (
        <div
          role="status"
          className="rise fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 border border-green-500 bg-slate-950/90 px-4 py-2 font-mono text-sm text-green-400 shadow-[0_0_22px_rgba(34,197,94,0.35)] backdrop-blur"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function Navbar({
  view,
  onNavigate,
  nick,
  score,
  level,
  clock,
  closed,
  sessionArmed,
  eventStarted,
  connection,
  tone,
}) {
  const offline = sessionArmed && connection === "offline";
  const statusLabel = offline
    ? "BAĞLANTI YOK"
    : !sessionArmed
      ? "KOD BEKLENİYOR"
      : !eventStarted
        ? "LOBİDE · ADMİN BEKLENİYOR"
        : closed
          ? "OTURUM KAPANDI"
          : "SİSTEM AKTİF";
  const statusColor = offline
    ? "text-rose-400"
    : !sessionArmed || !eventStarted
      ? "text-amber-300"
      : closed
        ? "text-rose-400"
        : "text-green-400";
  const statusDot = offline
    ? "bg-rose-400 animate-pulse"
    : !sessionArmed || !eventStarted
      ? "bg-amber-400 animate-pulse"
      : closed
        ? "bg-rose-400"
        : "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)]";

  return (
    <header className="sticky top-0 z-40 border-b border-cyan-500/40 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center border border-cyan-500 text-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.35)]">
            <Shield size={18} />
          </span>
          <div>
            <p className="font-mono text-sm tracking-[0.16em] text-cyan-300">
              CYBER DETECTIVES CTF
            </p>
            <p
              className={`flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] ${statusColor}`}
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot}`} />
              {statusLabel}
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-wrap items-center justify-center gap-1">
          {NAV.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`px-3 py-2 font-mono text-xs tracking-[0.14em] uppercase transition ${
                  active
                    ? "border-b-2 border-cyan-400 text-cyan-300"
                    : "text-slate-400 hover:text-cyan-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className={`flex items-center gap-2 border bg-slate-900/70 px-3 py-1.5 font-mono text-xs backdrop-blur ${tone}`}>
            <Clock size={14} />
            <span>{clock}</span>
          </div>
          <div className="flex items-center gap-2 border border-slate-700 bg-slate-900/70 px-3 py-1.5 font-mono text-xs backdrop-blur">
            <User size={14} className="text-cyan-400" />
            <span>{sessionArmed ? nick : "rumuz?"}</span>
            <span className="text-slate-600">|</span>
            <span className="text-green-400">{score} Puan</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">Seviye: {level}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function ChallengeBoard({
  openChallenges,
  totalCount = 0,
  solvedIds,
  scoreboard,
  hints,
  onToggleHint,
  onOpen,
  recent,
  board,
  profile,
  filter,
  onFilter,
  closed,
  clock,
  durationMs,
  elapsed,
  upcoming,
  waveNow,
}) {
  const matches = (item) => {
    if (filter === "Tümü") return true;
    return item.difficulty === filter;
  };
  const osint = openChallenges.filter(
    (item) => item.category === "osint" && matches(item)
  );
  const crypto = openChallenges.filter(
    (item) => item.category === "crypto" && matches(item)
  );
  const done = solvedIds.length;
  const ratio = Math.min(1, Math.max(0, elapsed / durationMs));
  const nextIn = upcoming
    ? msUntil(upcoming.at * 60 * 1000, elapsed)
    : 0;
  const filters = [
    { id: "Tümü", label: "Açıklar" },
    { id: "Kolay", label: "Kolay" },
    { id: "Orta", label: "Orta" },
    { id: "Zor", label: "Zor" },
  ];

  return (
    <div>
      <section
        className={`mb-4 border bg-slate-900/60 px-4 py-3 backdrop-blur ${
          closed ? "border-rose-500" : "border-cyan-500/60"
        }`}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={`font-mono text-[11px] tracking-[0.16em] ${closed ? "text-rose-400" : "text-cyan-400"}`}>
              {closed ? "OTURUM KAPANDI" : "OTURUM SÜRESİ"}
            </p>
            <p className={`mt-1 font-mono text-2xl tracking-wider ${closed ? "text-rose-300" : "text-green-400"}`}>
              {clock}
            </p>
          </div>
          <div className="max-w-md text-sm leading-relaxed text-slate-300">
            {closed ? (
              <p>Süre doldu. Çözdüğün bayraklar duruyor, yeni gönderim kapalı.</p>
            ) : (
              <>
                <p>
                  Şu an açık:{" "}
                  <span className="font-mono text-cyan-300">
                    {openChallenges.length}/{totalCount}
                  </span>
                  {" · "}
                  <span className="text-slate-400">{waveNow.label}</span>
                </p>
                {upcoming ? (
                  <p className="mt-1 font-mono text-xs text-amber-300">
                    Sonraki dalga {formatCountdown(nextIn)} · {upcoming.label}
                  </p>
                ) : (
                  <p className="mt-1 font-mono text-xs text-green-400">
                    Tüm dalgalar açıldı
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-slate-800">
          <div
            className={`h-full ${closed ? "bg-rose-400" : "bg-green-400"}`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      </section>

      <section className="relative border border-green-500 bg-slate-900/60 px-5 py-4 shadow-[0_0_24px_rgba(34,197,94,0.18)] backdrop-blur">
        <span className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l-2 border-t-2 border-green-500" />
        <span className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r-2 border-t-2 border-green-500" />
        <span className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b-2 border-l-2 border-green-500" />
        <span className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b-2 border-r-2 border-green-500" />
        <div className="flex items-start gap-3 pl-2">
          <Flag size={18} className="mt-0.5 shrink-0 text-green-400" />
          <div>
            <h1 className="font-mono text-sm tracking-[0.14em] text-green-400">
              ÖNEMLİ BİLGİ: BAYRAK (FLAG) NEDİR?
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-200">
              Sorularda bulduğun gizli kodları CTF{"{icerik}"} formatında girerek puan
              kazanabilirsin. Büyük/küçük harf fark etmez. Puan dinamiktir:{" "}
              {PARTICIPANTS} kişilik odada bir soru çözüldükçe değeri düşer; sen
              gönderdiğin andaki puanı alırsın.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs tracking-wide text-slate-400">
          Çözülen:{" "}
          <span className="text-green-400">
            {done}/{totalCount}
          </span>
          <span className="text-slate-600"> · </span>
          Ekranda:{" "}
          <span className="text-cyan-300">
            {openChallenges.length}
          </span>
          {done === totalCount && totalCount > 0 && (
            <span className="text-green-400"> · Tüm görevler tamamlandı</span>
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilter(item.id)}
              className={`border px-2.5 py-1 font-mono text-[11px] tracking-wide ${
                filter === item.id
                  ? "border-cyan-400 bg-cyan-400/15 text-cyan-200"
                  : "border-slate-700 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CategoryColumn
          category="osint"
          items={osint}
          solvedIds={solvedIds}
          scoreboard={scoreboard}
          hints={hints}
          elapsed={elapsed}
          onToggleHint={onToggleHint}
          onOpen={onOpen}
        />
        <CategoryColumn
          category="crypto"
          items={crypto}
          solvedIds={solvedIds}
          scoreboard={scoreboard}
          hints={hints}
          elapsed={elapsed}
          onToggleHint={onToggleHint}
          onOpen={onOpen}
        />
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <ProfileWidget profile={profile} />
          <WaveWidget elapsed={elapsed} upcoming={upcoming} />
          <DynamicScoreWidget />
          <RecentWidget recent={recent} />
          <MiniBoard board={board} />
        </aside>
      </div>
    </div>
  );
}

function CategoryColumn({
  category,
  items,
  solvedIds,
  scoreboard,
  hints,
  elapsed,
  onToggleHint,
  onOpen,
}) {
  const theme = CATEGORIES[category];
  const solvedHere = items.filter((item) => solvedIds.includes(item.id)).length;

  return (
    <section>
      <header className="mb-4">
        <div className={`mb-2 h-px w-16 ${theme.line}`} />
        <h2 className={`font-mono text-xs leading-snug tracking-wide ${theme.text}`}>
          {theme.title}
        </h2>
        <p className="mt-1 font-mono text-[11px] text-slate-500">
          {solvedHere}/{items.length} çözüldü · {items.length} açık
        </p>
      </header>
      <div className="space-y-4">
        {items.length === 0 && (
          <p className="border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-500">
            Bu kategoride henüz açık soru yok. Sonraki dalgayı bekle.
          </p>
        )}
        {items.map((challenge) => {
          const hintReady = isHintOpen(challenge, elapsed);
          const hintRemaining = msUntil(
            (unlockMinuteFor(challenge.id) + hintDelayFor(challenge)) * 60 * 1000,
            elapsed
          );
          return (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              theme={theme}
              meta={scoreboard[challenge.id]}
              solved={solvedIds.includes(challenge.id)}
              hintReady={hintReady}
              hintRemaining={hintRemaining}
              hintOpen={Boolean(hints[challenge.id]) && hintReady}
              onToggleHint={() => onToggleHint(challenge.id)}
              onOpen={() => onOpen(challenge.id)}
            />
          );
        })}
      </div>
    </section>
  );
}

function ChallengeCard({
  challenge,
  theme,
  meta,
  solved,
  hintReady,
  hintRemaining,
  hintOpen,
  onToggleHint,
  onOpen,
}) {
  const Icon = challenge.icon;
  const shown = solved ? meta.payout : meta.current;
  const dropped = shown < meta.initial;

  return (
    <article
      className={`border bg-slate-900/60 p-4 backdrop-blur transition hover:-translate-y-0.5 ${
        solved
          ? "border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.22)]"
          : `${theme.border} ${theme.glow}`
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border ${
              solved ? "border-green-500 text-green-400" : theme.iconWrap
            }`}
          >
            {solved ? <Check size={16} /> : <Icon size={16} />}
          </span>
          <h3 className="font-mono text-sm leading-snug text-slate-100">
            {challenge.title}
          </h3>
        </div>
        <p className="shrink-0 text-right font-mono">
          <span className="block text-[10px] tracking-[0.16em] text-slate-500">
            {solved ? "ALINAN" : "ANLIK"}
          </span>
          <span className="text-sm text-green-400">{shown}</span>
          {dropped && !solved && (
            <span className="mt-0.5 block text-[10px] text-slate-500 line-through">
              {meta.initial}
            </span>
          )}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`border px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] uppercase ${DIFFICULTY[challenge.difficulty]}`}
        >
          {challenge.difficulty}
        </span>
        <span className="font-mono text-[10px] tracking-wide text-slate-500">
          ≈ {challenge.minutes} dk
        </span>
        <span className="font-mono text-[10px] tracking-wide text-slate-400">
          {meta.solves}/{PARTICIPANTS} çözdü
        </span>
        {solved && (
          <span className="border border-green-500 bg-green-500/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] text-green-400">
            Çözüldü
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-400">{challenge.description}</p>

      {hintOpen && (
        <p className={`mt-3 border border-dashed bg-slate-950/60 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300 ${theme.border}`}>
          <span className={theme.text}>İPUCU · </span>
          {challenge.hint}
        </p>
      )}

      {!hintReady && !solved && (
        <p className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
          <Lock size={12} />
          İpucu {formatCountdown(hintRemaining)} sonra
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onToggleHint}
          disabled={!hintReady}
          className={`border px-2 py-2 text-center font-mono text-[11px] tracking-wide transition ${
            hintReady
              ? theme.button
              : "cursor-not-allowed border-slate-700 text-slate-600"
          }`}
        >
          {!hintReady
            ? `[ KİLİTLİ ${formatCountdown(hintRemaining)} ]`
            : hintOpen
              ? "[ İPUCUYU GİZLE ]"
              : "[ İPUCU AL ]"}
        </button>
        <button
          type="button"
          onClick={onOpen}
          className={`border px-2 py-2 text-center font-mono text-[11px] tracking-wide transition ${
            solved
              ? "border-green-500 text-green-300 hover:bg-green-500/15 hover:shadow-[0_0_16px_rgba(34,197,94,0.45)]"
              : theme.button
          }`}
        >
          {solved ? "[ ÇÖZÜMÜ GÖR ]" : "[ SORUYU AÇ ]"}
        </button>
      </div>
    </article>
  );
}

function WaveWidget({ elapsed, upcoming }) {
  return (
    <section className="border border-slate-700 bg-slate-900/60 p-4 backdrop-blur">
      <h2 className="flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-cyan-400">
        <Clock size={14} />
        SORU DALGALARI
      </h2>
      <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {RELEASE_WAVES.map((wave) => {
          const open = elapsed >= wave.at * 60 * 1000;
          const isNext = upcoming?.at === wave.at;
          return (
            <li
              key={wave.at}
              className={`border-l-2 px-2 py-1.5 ${
                open
                  ? "border-green-500 bg-green-500/10"
                  : isNext
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-slate-700"
              }`}
            >
              <p
                className={`font-mono text-[11px] ${
                  open
                    ? "text-green-300"
                    : isNext
                      ? "text-amber-300"
                      : "text-slate-400"
                }`}
              >
                {wave.at === 0 ? "00:00" : `${wave.at}. dk`} · {wave.ids.length} soru
              </p>
              <p className="text-[11px] text-slate-500">{wave.label}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ProfileWidget({ profile }) {
  const osint = profile?.byCategory?.osint ?? 0;
  const crypto = profile?.byCategory?.crypto ?? 0;
  return (
    <section className="border border-slate-700 bg-slate-900/60 p-4 backdrop-blur">
      <h2 className="flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-cyan-300">
        <User size={14} />
        PROFİL ÖZETİ
      </h2>
      <p className="mt-2 font-mono text-sm text-slate-200">
        {profile?.solvedCount ?? 0} çözüm · +{profile?.totalEarned ?? 0} puan
      </p>
      <p className="mt-1 font-mono text-[11px] text-slate-500">
        OSINT {osint} · CRYPTO {crypto}
      </p>
    </section>
  );
}

function DynamicScoreWidget() {
  const sample = dynamicPoints(250, 20);
  return (
    <section className="border border-slate-700 bg-slate-900/60 p-4 backdrop-blur">
      <h2 className="flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-amber-300">
        <Trophy size={14} />
        DİNAMİK PUAN
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        Oda: {PARTICIPANTS} kişi. Soru çözüldükçe değeri düşer. Erken çözen daha çok alır.
      </p>
      <div className="mt-3 border border-slate-800 bg-slate-950/60 p-2.5 font-mono text-[11px] text-slate-300">
        <p>
          Örnek 250 →{" "}
          <span className="text-green-400">{sample}</span> (20 çözüm)
        </p>
        <p className="mt-1 text-slate-500">Taban ≈ %20 · Decay {DECAY}</p>
      </div>
    </section>
  );
}

function RecentWidget({ recent }) {
  return (
    <section className="border border-slate-700 bg-slate-900/60 p-4 backdrop-blur">
      <h2 className="flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-green-400">
        <Lightbulb size={14} />
        SON ÇÖZÜLENLER
      </h2>
      {recent.length === 0 ? (
        <p className="mt-3 font-mono text-xs text-slate-500">
          Henüz çözüm yok. İlk bayrak burada görünür.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {recent.map((item) => (
            <li
              key={item.id}
              className="border-b border-slate-800 pb-2.5 last:border-0 last:pb-0"
            >
              <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span
                  className={item.isUser ? "text-green-400" : "text-cyan-300"}
                >
                  {item.user}
                </span>
                <span className="text-green-400">+{item.points}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {item.title}
                <span className="text-slate-600"> · {item.when}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MiniBoard({ board }) {
  return (
    <section className="border border-slate-700 bg-slate-900/60 p-4 backdrop-blur">
      <h2 className="flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-green-400">
        <Trophy size={14} />
        PUAN TABLOSU (CANLI)
      </h2>
      {board.length === 0 ? (
        <p className="mt-3 font-mono text-xs text-slate-500">
          Henüz oyuncu yok. Skorlar burada anlık güncellenir.
        </p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {board.slice(0, 10).map((row, index) => (
            <li
              key={`${row.name}-${index}`}
              className={`flex items-center justify-between gap-2 px-2 py-1.5 font-mono text-xs ${
                row.isUser
                  ? "border-l-2 border-green-500 bg-green-500/10 text-green-300"
                  : "text-slate-300"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 text-slate-500">{index + 1}</span>
                <span className="truncate">{row.name}</span>
              </span>
              <span className="shrink-0 text-green-400">{row.score}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function SolveModal({
  challenge,
  meta,
  solved,
  closed,
  hintReady,
  hintRemaining,
  hintOpen,
  draft,
  flagError,
  onDraft,
  onClearError,
  onToggleHint,
  onClose,
  onSubmit,
}) {
  const theme = CATEGORIES[challenge.category];
  const shown = meta.payout;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-title"
        className={`rise relative max-h-[85vh] w-full max-w-xl overflow-y-auto border bg-slate-900/90 p-5 shadow-[0_0_32px_rgba(15,23,42,0.45)] ${theme.border} ${theme.glow}`}
        onClick={(event) => event.stopPropagation()}
      >
        <span className={`pointer-events-none absolute left-2 top-2 h-3 w-3 border-l-2 border-t-2 ${theme.border}`} />
        <span className={`pointer-events-none absolute right-2 top-2 h-3 w-3 border-r-2 border-t-2 ${theme.border}`} />

        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`font-mono text-[11px] tracking-[0.16em] ${theme.text}`}>
              {challenge.category === "osint" ? "OSINT DOSYASI" : "CRYPTO DOSYASI"}
            </p>
            <h2 id="challenge-title" className="mt-1 font-mono text-lg text-slate-100">
              {challenge.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="border border-slate-600 p-1.5 text-slate-300 hover:border-cyan-400 hover:text-cyan-300"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`border px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] ${theme.chip}`}>
            {challenge.category === "osint" ? "OSINT" : "CRYPTO"}
          </span>
          <span
            className={`border px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] uppercase ${DIFFICULTY[challenge.difficulty]}`}
          >
            {challenge.difficulty}
          </span>
          <span className="font-mono text-xs text-green-400">
            {shown} puan
            {shown < meta.initial && (
              <span className="ml-2 text-slate-500 line-through">{meta.initial}</span>
            )}
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {meta.solves}/{PARTICIPANTS} çözdü
          </span>
        </div>

        <div className="mt-4 max-h-[40vh] overflow-y-auto rounded-sm border border-slate-800 bg-slate-950/70 p-3 sm:max-h-none">
          <p className="text-[15px] leading-7 text-slate-200 sm:text-sm sm:leading-relaxed whitespace-pre-wrap">
            {challenge.story}
          </p>
        </div>

        <div className="mt-3 border border-amber-400/40 bg-amber-400/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-amber-100/90">
          Dinamik puan: şimdi gönderirsen <span className="text-green-400">{shown}</span> alırsın.
          Taban {meta.minimum}. Daha çok kişi çözdükçe değer düşer.
        </div>

        <button
          type="button"
          onClick={onToggleHint}
          disabled={!hintReady}
          className={`mt-3 border px-3 py-2 font-mono text-[11px] tracking-wide transition ${
            hintReady
              ? theme.button
              : "cursor-not-allowed border-slate-700 text-slate-600"
          }`}
        >
          {!hintReady
            ? `[ İPUCU KİLİTLİ · ${formatCountdown(hintRemaining)} ]`
            : hintOpen
              ? "[ İPUCUYU GİZLE ]"
              : "[ İPUCU AL ]"}
        </button>
        {!hintReady && (
          <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
            <Lock size={12} />
            İpucu, soru açıldıktan {hintDelayFor(challenge)} dk sonra gelir.
          </p>
        )}
        {hintOpen && (
          <p className={`mt-2 border border-dashed p-2.5 font-mono text-xs leading-relaxed text-slate-300 ${theme.border}`}>
            {challenge.hint}
          </p>
        )}

        {solved ? (
          <div className="mt-5 border border-green-500 bg-green-500/10 p-3">
            <p className="flex items-center gap-2 font-mono text-sm text-green-400">
              <Check size={16} />
              Bu görev çözüldü · +{meta.payout} puan kilitlendi
            </p>
            <p className="mt-2 font-mono text-sm text-green-300">{challenge.flag}</p>
          </div>
        ) : closed ? (
          <div className="mt-5 border border-rose-500 bg-rose-500/10 p-3">
            <p className="font-mono text-sm text-rose-300">
              Süre doldu. Bu oturumda yeni bayrak kabul edilmiyor.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5">
            <label htmlFor="flag-input" className="font-mono text-[11px] tracking-[0.16em] text-green-400">
              BAYRAK
            </label>
            <input
              id="flag-input"
              value={draft}
              onChange={(event) => {
                onDraft(event.target.value);
                onClearError();
              }}
              placeholder="CTF{ornek_cevap}"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              title="Büyük/küçük harf fark etmez"
              className="mt-2 w-full border border-green-500/70 bg-slate-950 px-3 py-2 font-mono text-sm text-green-300 outline-none placeholder:text-slate-600 focus:shadow-[0_0_16px_rgba(34,197,94,0.35)]"
            />
            {flagError && (
              <p className="mt-2 font-mono text-xs text-rose-400">{flagError}</p>
            )}
            <button
              type="submit"
              className="mt-3 w-full border border-green-500 py-2.5 font-mono text-xs tracking-[0.18em] text-green-400 transition hover:bg-green-500/15 hover:shadow-[0_0_18px_rgba(34,197,94,0.5)]"
            >
              [ BAYRAĞI GÖNDER ]
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function LeaderboardPage({ board }) {
  const userRank = board.findIndex((row) => row.isUser) + 1;

  return (
    <section className="border border-green-500/50 bg-slate-900/60 p-5 backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-green-400">SIRALAMA</p>
          <h1 className="mt-1 font-mono text-xl text-slate-100">Liderlik Tablosu</h1>
          <p className="mt-1 text-xs text-slate-500">
            Canlı sıralama — sunucudan ~8 sn’de bir yenilenir.
          </p>
        </div>
        <p className="font-mono text-xs text-slate-400">
          Senin sıran:{" "}
          <span className="text-green-400">{userRank > 0 ? userRank : "—"}</span>
        </p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="border-b border-slate-700 font-mono text-[11px] tracking-[0.14em] text-slate-500">
              <th className="px-3 py-2 font-medium">SIRA</th>
              <th className="px-3 py-2 font-medium">OYUNCU</th>
              <th className="px-3 py-2 font-medium">ÇÖZÜLEN</th>
              <th className="px-3 py-2 text-right font-medium">PUAN</th>
            </tr>
          </thead>
          <tbody>
            {board.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 font-mono text-sm text-slate-500"
                >
                  Henüz oyuncu yok.
                </td>
              </tr>
            )}
            {board.map((row, index) => (
              <tr
                key={`${row.name}-${index}`}
                className={`border-b border-slate-800 font-mono text-sm ${
                  row.isUser ? "bg-green-500/10 text-green-300" : "text-slate-300"
                }`}
              >
                <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                <td className="px-3 py-3">
                  {row.name}
                  {row.isUser && (
                    <span className="ml-2 border border-green-500 px-1.5 py-0.5 text-[10px] text-green-400">
                      SEN
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">{row.solved}</td>
                <td className="px-3 py-3 text-right text-green-400">{row.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WaitingRoom({ nick, lobbyCount }) {
  return (
    <section className="border border-amber-400/60 bg-amber-400/10 p-6 backdrop-blur">
      <p className="font-mono text-[11px] tracking-[0.16em] text-amber-200">
        LOBİ
      </p>
      <h1 className="mt-2 font-mono text-2xl text-amber-50">
        Admin onayı bekleniyor
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-amber-50/90">
        Merhaba <span className="font-mono text-cyan-300">{nick}</span>. Girişin
        tamam. Herkes toplanınca moderatör oyunu başlatacak; süre ve sorular o
        anda açılır. Bu ekranı açık tutman yeterli.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <div className="border border-amber-400/40 bg-slate-950/50 px-4 py-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-slate-500">
            LOBİDEKİ OYUNCU
          </p>
          <p className="mt-1 font-mono text-xl text-cyan-300">{lobbyCount}</p>
        </div>
        <div className="border border-amber-400/40 bg-slate-950/50 px-4 py-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-slate-500">
            DURUM
          </p>
          <p className="mt-1 font-mono text-sm text-amber-200 animate-pulse">
            Bekleniyor…
          </p>
        </div>
      </div>
    </section>
  );
}

function HowToPage({ sessionArmed, eventStarted, onGoChallenges, onStartSession }) {
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [nickDraft, setNickDraft] = useState("");
  const [accessDraft, setAccessDraft] = useState("");
  const [accessError, setAccessError] = useState("");
  const steps = [
    {
      icon: User,
      title: "Rumuzunu yaz",
      text: "Liderlik tablosunda görünecek adını seç. 3-18 karakter; harf, rakam ve _ kullanılabilir.",
    },
    {
      icon: KeyRound,
      title: "Kodu gir",
      text: "Moderatörün verdiği kod ile giriş yap. Önce lobide beklersin; süre admin herkesi başlatınca akar.",
    },
    {
      icon: Clock,
      title: "Dalgaları bekle",
      text: "Oyun başlayınca önce 3 kolay soru vardır. 15. dk'da 3 orta, 45. dk'da 1 zor gelir. Saat başlarında yeni kolaylar açılır.",
    },
    {
      icon: Lightbulb,
      title: "İpucu gecikir",
      text: "İpucu hemen açılmaz. Kolayda 8 dk, ortada 12 dk, zorda 15 dk sonra [ İPUCU AL ] aktif olur. İpucu puan düşürmez.",
    },
    {
      icon: Flag,
      title: "Bayrağı gönder",
      text: "Kodu CTF{icerik} biçiminde yaz. Büyük/küçük harf fark etmez (CTF{ABC} = CTF{abc}). İçerikte yalnızca harf, rakam ve _ kullanılır.",
    },
    {
      icon: Trophy,
      title: "Dinamik puan",
      text: `Oda ${PARTICIPANTS} kişi. 250 puanlık bir soru ~20 çözümde ~200'e iner. Erken çözmek daha çok puan demektir.`,
    },
    {
      icon: BookOpen,
      title: "Seviyeni izle",
      text: "Seviye 1 başlangıçtır. 1000, 1800, 2800, 4000 ve 5200 puanda bir üst seviyeye geçersin.",
    },
  ];

  async function submitAccess(event) {
    event.preventDefault();
    setAccessError("");
    const result = await onStartSession({ code: accessDraft, nick: nickDraft });
    if (!result.ok) {
      setAccessError(result.error);
      return;
    }
    setNickDraft("");
    setAccessDraft("");
    setShowCodeBox(false);
  }

  return (
    <section className="border border-cyan-500/50 bg-slate-900/60 p-5 backdrop-blur">
      <p className="font-mono text-[11px] tracking-[0.16em] text-cyan-400">BAŞLANGIÇ</p>
      <h1 className="mt-1 font-mono text-xl text-slate-100">Nasıl Oynanır?</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
        Bu masa tam {SESSION_HOURS} saatlik bir bulmaca oturumudur. Rumuz + kod ile giriş
        yap, lobide bekle; admin onaylayınca süre ve sorular herkes için aynı anda açılır.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <article key={step.title} className="border border-slate-700 bg-slate-950/50 p-4">
              <Icon size={16} className="text-cyan-400" />
              <h2 className="mt-2 font-mono text-sm text-slate-100">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.text}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {sessionArmed && eventStarted ? (
          <button
            type="button"
            onClick={onGoChallenges}
            className="border border-green-500 px-4 py-2 font-mono text-xs tracking-[0.16em] text-green-400 transition hover:bg-green-500/15 hover:shadow-[0_0_16px_rgba(34,197,94,0.45)]"
          >
            [ GÖREVLERE DÖN ]
          </button>
        ) : !sessionArmed ? (
          <button
            type="button"
            onClick={() => {
              setShowCodeBox(true);
              setAccessError("");
            }}
            className="border border-cyan-500 px-4 py-2 font-mono text-xs tracking-[0.14em] text-cyan-300 transition hover:bg-cyan-400/15"
          >
            [ GİRİŞ YAP ]
          </button>
        ) : null}
      </div>

      {sessionArmed && eventStarted && (
        <p className="mt-4 border border-green-500/50 bg-green-500/10 px-3 py-2 font-mono text-xs text-green-300">
          Oyun açık. Bu tarayıcıda yeniden giriş kapalı.
        </p>
      )}

      {!sessionArmed && showCodeBox && (
        <form
          onSubmit={submitAccess}
          className="mt-4 border border-amber-400/70 bg-amber-400/10 p-4"
        >
          <p className="font-mono text-[11px] tracking-[0.14em] text-amber-200">
            RUMUZ + BAŞLANGIÇ KODU
          </p>
          <p className="mt-1 text-sm text-amber-50/90">
            Rumuzunu ve moderatör kodunu gir. Girişten sonra lobidesin; admin
            başlatınca {SESSION_HOURS} saatlik sayaç herkes için açılır.
          </p>
          <label htmlFor="nick-input" className="mt-3 block font-mono text-[11px] text-cyan-300">
            RUMUZ
          </label>
          <input
            id="nick-input"
            value={nickDraft}
            onChange={(event) => {
              setNickDraft(event.target.value);
              setAccessError("");
            }}
            placeholder="ornek_hacker"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            maxLength={NICK_MAX}
            className="mt-1 w-full border border-cyan-500/50 bg-slate-950 px-3 py-2 font-mono text-sm text-cyan-100 outline-none placeholder:text-slate-600 focus:shadow-[0_0_14px_rgba(34,211,238,0.25)]"
          />
          <label htmlFor="access-input" className="mt-3 block font-mono text-[11px] text-amber-200">
            BAŞLANGIÇ KODU
          </label>
          <input
            id="access-input"
            value={accessDraft}
            onChange={(event) => {
              setAccessDraft(event.target.value);
              setAccessError("");
            }}
            placeholder="Başlangıç kodu"
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full border border-amber-400/60 bg-slate-950 px-3 py-2 font-mono text-sm text-amber-100 outline-none placeholder:text-slate-600 focus:shadow-[0_0_14px_rgba(251,191,36,0.25)]"
          />
          {accessError && (
            <p className="mt-2 font-mono text-xs text-rose-400">{accessError}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              className="border border-green-500 px-3 py-1.5 font-mono text-[11px] text-green-300"
            >
              [ OTURUMU AÇ ]
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCodeBox(false);
                setNickDraft("");
                setAccessDraft("");
                setAccessError("");
              }}
              className="border border-slate-600 px-3 py-1.5 font-mono text-[11px] text-slate-300"
            >
              [ VAZGEÇ ]
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
