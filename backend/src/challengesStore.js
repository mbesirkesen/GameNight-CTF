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

/** Sabit biçim: CTF{küçük_harf_icerik} — karşılaştırma büyük/küçük harf duyarsız. */
export function normalizeFlag(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^ctf\{([a-z0-9_]+)\}$/i);
  if (!match) return null;
  return `CTF{${match[1].toLowerCase()}}`;
}

export function flagsMatch(submitted, expected) {
  const left = normalizeFlag(submitted);
  const right = normalizeFlag(expected);
  return Boolean(left && right && left === right);
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
  const minutes = Math.max(5, Math.round(Number(input.minutes) || 15));
  const unlockAt = Math.max(0, Math.round(Number(input.unlockAt) || 0));
  const flag = normalizeFlag(input.flag);
  if (!flag) {
    throw new Error(
      "Bayrak biçimi: CTF{icerik} — yalnızca a-z, 0-9 ve _ (büyük/küçük harf fark etmez)"
    );
  }
  const title = String(input.title || "").trim();
  if (title.length < 3) throw new Error("Başlık çok kısa");
  const icon = ICONS.includes(input.icon) ? input.icon : "Search";

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
