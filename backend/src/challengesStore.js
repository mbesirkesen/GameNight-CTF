import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "data", "challenges.json");

const ICONS = [
  "Search",
  "FileText",
  "Route",
  "Library",
  "MapPinned",
  "Receipt",
  "StickyNote",
  "FolderOpen",
  "Calendar",
  "ListOrdered",
  "KeyRound",
  "Undo2",
  "Type",
  "Binary",
  "Hash",
  "Newspaper",
  "Layers",
];

/**
 * Türkçe İ/ı/I/i ve birleşik nokta (İ.toLowerCase → i̇) sorununu düzelt.
 * Bayrak içeriği ASCII a-z olarak katlanır.
 */
export function foldFlagText(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\u0130/g, "i") // İ
    .replace(/\u0049/g, "i") // I
    .replace(/\u0131/g, "i") // ı
    .replace(/\u0069/g, "i") // i
    .replace(/\u0307/g, "") // combining dot above
    .toLocaleLowerCase("en-US");
}

/** Sabit biçim: CTF{küçük_harf_icerik} — i/İ/ı ve büyük/küçük harf fark etmez. */
export function normalizeFlag(value) {
  const folded = foldFlagText(value);
  const match = folded.match(/^ctf\{([a-z0-9_]+)\}$/);
  if (!match) return null;
  return `CTF{${match[1]}}`;
}

export function flagsMatch(submitted, expected) {
  const left = normalizeFlag(submitted);
  const right = normalizeFlag(expected);
  return Boolean(left && right && left === right);
}

/** Opsiyonel http(s) URL veya /uploads/... yolu; boş bırakılabilir. */
export function normalizeOptionalUrl(value, { field = "url", max = 500 } = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length > max) {
    throw new Error(`${field}: en fazla ${max} karakter`);
  }
  if (raw.startsWith("/uploads/")) {
    if (!/^\/uploads\/[a-zA-Z0-9._-]+$/.test(raw)) {
      throw new Error(`${field}: geçersiz yükleme yolu`);
    }
    return raw;
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${field}: geçerli http(s) adresi veya yüklenen dosya olmalı`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${field}: yalnızca http veya https`);
  }
  return parsed.toString();
}

function readRaw() {
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function rebuildWaves(challenges, previousWaves = []) {
  const labelByAt = Object.fromEntries(
    (previousWaves || []).map((wave) => [wave.at, wave.label])
  );
  const groups = new Map();
  for (const item of challenges) {
    const at = Number(item.unlockAt ?? 0);
    if (!groups.has(at)) groups.set(at, []);
    groups.get(at).push(item.id);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([at, ids]) => ({
      at,
      ids,
      label:
        labelByAt[at] ||
        (at === 0 ? `Açılış · ${ids.length} soru` : `${at}. dk · ${ids.length} soru`),
    }));
}

function normalizeChallenge(input, { existingId = null } = {}) {
  const id = String(input.id || existingId || "").trim();
  if (!/^[a-z0-9-]{3,40}$/.test(id)) {
    throw new Error("id: küçük harf, rakam ve - (3-40 karakter)");
  }
  const category = input.category === "crypto" ? "crypto" : "osint";
  const difficulty = ["Kolay", "Orta", "Zor"].includes(input.difficulty)
    ? input.difficulty
    : "Kolay";
  const points = Math.max(50, Math.round(Number(input.points) || 100));
  const minutes = Math.max(1, Math.round(Number(input.minutes) || 15));
  const unlockAt = Math.max(0, Math.round(Number(input.unlockAt) || 0));
  const decaySolves = Math.max(1, Math.round(Number(input.decaySolves) || 10));
  const decayDrop = Math.max(0, Math.round(Number(input.decayDrop) || 50));
  const minPoints = Math.max(
    50,
    Math.round(Number(input.minPoints) > 0 ? Number(input.minPoints) : 100)
  );
  if (minPoints > points) {
    throw new Error("Taban puan, başlangıç puanından büyük olamaz");
  }
  const flag = normalizeFlag(input.flag);
  if (!flag) {
    throw new Error(
      "Bayrak biçimi: CTF{icerik} — yalnızca a-z, 0-9 ve _ (büyük/küçük harf fark etmez)"
    );
  }
  const title = String(input.title || "").trim();
  if (title.length < 3) throw new Error("Başlık çok kısa");
  const icon = ICONS.includes(input.icon) ? input.icon : "Search";
  const imageUrl = normalizeOptionalUrl(input.imageUrl, { field: "imageUrl" });
  const linkUrl = normalizeOptionalUrl(input.linkUrl, { field: "linkUrl" });
  const linkLabel = String(input.linkLabel || "")
    .trim()
    .slice(0, 80);

  return {
    id,
    category,
    title,
    points,
    minutes,
    difficulty,
    icon,
    description: String(input.description || "").trim(),
    story: String(input.story || "").trim(),
    hint: String(input.hint || "").trim(),
    imageUrl,
    linkUrl,
    linkLabel: linkUrl ? linkLabel : "",
    decaySolves,
    decayDrop,
    minPoints,
    flag,
    unlockAt,
  };
}

function persist(challenges, waves) {
  const withUnlock = challenges.map((item) => ({ ...item }));
  const next = {
    RELEASE_WAVES: rebuildWaves(withUnlock, waves),
    CHALLENGES: withUnlock,
  };
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return loadStore();
}

function hydrate(raw) {
  const unlockAt = Object.fromEntries(
    (raw.RELEASE_WAVES || []).flatMap((wave) =>
      wave.ids.map((id) => [id, wave.at])
    )
  );
  const challenges = (raw.CHALLENGES || []).map((item) => ({
    ...item,
    unlockAt:
      typeof item.unlockAt === "number" ? item.unlockAt : unlockAt[item.id] ?? 0,
  }));
  const waves = rebuildWaves(challenges, raw.RELEASE_WAVES || []);
  return {
    challenges,
    waves,
    byId: Object.fromEntries(challenges.map((item) => [item.id, item])),
    unlockAt: Object.fromEntries(
      challenges.map((item) => [item.id, item.unlockAt ?? 0])
    ),
  };
}

let cache = hydrate(readRaw());

export function loadStore() {
  cache = hydrate(readRaw());
  return cache;
}

export function getStore() {
  return cache;
}

export function listChallenges() {
  return cache.challenges;
}

export function listWaves() {
  return cache.waves;
}

export function getChallenge(id) {
  return cache.byId[id] || null;
}

export function getUnlockAt(id) {
  return cache.unlockAt[id] ?? 0;
}

export function upsertChallenge(input, { isNew = false } = {}) {
  const store = getStore();
  const id = String(input.id || "").trim();
  if (isNew && store.byId[id]) {
    throw new Error("Bu id zaten var");
  }
  if (!isNew && !store.byId[id]) {
    throw new Error("Soru bulunamadı");
  }
  const challenge = normalizeChallenge(input, { existingId: id });
  const challenges = isNew
    ? [...store.challenges, challenge]
    : store.challenges.map((item) => (item.id === id ? challenge : item));
  return persist(challenges, store.waves);
}

export function removeChallenge(id) {
  const store = getStore();
  if (!store.byId[id]) throw new Error("Soru bulunamadı");
  const challenges = store.challenges.filter((item) => item.id !== id);
  return persist(challenges, store.waves);
}

export const CHALLENGE_ICONS = ICONS;
