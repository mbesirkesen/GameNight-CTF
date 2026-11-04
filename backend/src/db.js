import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "ctf.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    nick TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    score INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS solves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    challenge_id TEXT NOT NULL,
    points INTEGER NOT NULL,
    solved_at INTEGER NOT NULL,
    UNIQUE(player_id, challenge_id),
    FOREIGN KEY(player_id) REFERENCES players(id)
  );

  CREATE TABLE IF NOT EXISTS force_unlocks (
    challenge_id TEXT PRIMARY KEY,
    unlocked_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS banned_nicks (
    nick TEXT PRIMARY KEY,
    reason TEXT,
    banned_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    nick TEXT,
    detail TEXT
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

const backupDir = path.join(dataDir, "backups");
fs.mkdirSync(backupDir, { recursive: true });
const dbPath = path.join(dataDir, "ctf.sqlite");

export function getMeta(key, fallback = null) {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

export function setMeta(key, value) {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, String(value));
}

export function getEvent() {
  const startedAt = Number(getMeta("startedAt", "0"));
  const durationMs = Number(getMeta("durationMs", String(3 * 60 * 60 * 1000)));
  const frozen = getMeta("frozen", "0") === "1";
  const frozenElapsedMs = Number(getMeta("frozenElapsedMs", "0"));
  return {
    started: startedAt > 0,
    startedAt: startedAt || null,
    durationMs,
    frozen,
    frozenElapsedMs,
    practice: getMeta("practice", "0") === "1",
  };
}

export function ensureEventStarted(durationMs) {
  return startEvent(durationMs);
}

/** Süreyi ayarlar ama sayacı başlatmaz (lobi). */
export function prepareEvent(durationMs) {
  const event = getEvent();
  if (!event.started) {
    setMeta("durationMs", durationMs);
    setMeta("frozen", "0");
    setMeta("frozenElapsedMs", "0");
  }
  return getEvent();
}

/** Admin onayı: 3 saatlik sayaç herkes için buradan başlar. */
export function startEvent(durationMs) {
  const event = getEvent();
  if (event.started) return event;
  const ms = Number(durationMs) || event.durationMs || 3 * 60 * 60 * 1000;
  setMeta("startedAt", Date.now());
  setMeta("durationMs", ms);
  setMeta("frozen", "0");
  setMeta("frozenElapsedMs", "0");
  return getEvent();
}

export function createPlayer(id, nick, token, startScore) {
  db.prepare(
    "INSERT INTO players (id, nick, token, score, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, nick, token, startScore, Date.now());
  return getPlayerByToken(token);
}

export function getPlayerByToken(token) {
  return db.prepare("SELECT * FROM players WHERE token = ?").get(token) || null;
}

export function getPlayerByNick(nick) {
  return db.prepare("SELECT * FROM players WHERE nick = ?").get(nick) || null;
}

export function listPlayers() {
  return db
    .prepare(
      `SELECT p.*, (
         SELECT COUNT(*) FROM solves s WHERE s.player_id = p.id
       ) AS solved
       FROM players p
       ORDER BY p.score DESC, p.created_at ASC`
    )
    .all();
}

export function updatePlayerScore(playerId, score) {
  db.prepare("UPDATE players SET score = ? WHERE id = ?").run(score, playerId);
}

export function addScore(playerId, delta) {
  db.prepare("UPDATE players SET score = score + ? WHERE id = ?").run(delta, playerId);
}

export function getSolve(playerId, challengeId) {
  return (
    db
      .prepare("SELECT * FROM solves WHERE player_id = ? AND challenge_id = ?")
      .get(playerId, challengeId) || null
  );
}

export function listSolvesForPlayer(playerId) {
  return db
    .prepare(
      "SELECT challenge_id, points, solved_at FROM solves WHERE player_id = ? ORDER BY solved_at DESC"
    )
    .all(playerId);
}

export function countSolves(challengeId) {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM solves WHERE challenge_id = ?")
    .get(challengeId);
  return row?.c ?? 0;
}

export function insertSolve(playerId, challengeId, points) {
  const info = db
    .prepare(
      "INSERT INTO solves (player_id, challenge_id, points, solved_at) VALUES (?, ?, ?, ?)"
    )
    .run(playerId, challengeId, points, Date.now());
  addScore(playerId, points);
  return info;
}

export function recentSolves(limit = 20) {
  return db
    .prepare(
      `SELECT s.challenge_id, s.points, s.solved_at, p.nick
       FROM solves s
       JOIN players p ON p.id = s.player_id
       ORDER BY s.solved_at DESC
       LIMIT ?`
    )
    .all(limit);
}

export function forceUnlock(challengeId) {
  db.prepare(
    "INSERT INTO force_unlocks (challenge_id, unlocked_at) VALUES (?, ?) ON CONFLICT(challenge_id) DO UPDATE SET unlocked_at = excluded.unlocked_at"
  ).run(challengeId, Date.now());
}

export function listForceUnlocks() {
  return db.prepare("SELECT challenge_id, unlocked_at FROM force_unlocks").all();
}

export function isForceUnlocked(challengeId) {
  return Boolean(
    db.prepare("SELECT 1 FROM force_unlocks WHERE challenge_id = ?").get(challengeId)
  );
}

export function extendDuration(extraMs) {
  const event = getEvent();
  setMeta("durationMs", event.durationMs + extraMs);
  return getEvent();
}

export function setFrozen(frozen) {
  const event = getEvent();
  if (frozen) {
    if (!event.started || !event.startedAt) {
      setMeta("frozen", "1");
      setMeta("frozenElapsedMs", "0");
      return getEvent();
    }
    if (event.frozen) return event;
    const elapsed = Math.min(
      Math.max(0, Date.now() - event.startedAt),
      event.durationMs
    );
    setMeta("frozenElapsedMs", elapsed);
    setMeta("frozen", "1");
  } else {
    if (!event.frozen) return event;
    const pausedElapsed = Number(getMeta("frozenElapsedMs", "0"));
    if (event.started) {
      // Süre kaldığı yerden devam etsin
      setMeta("startedAt", Date.now() - pausedElapsed);
    }
    setMeta("frozen", "0");
    setMeta("frozenElapsedMs", "0");
  }
  return getEvent();
}

export function wipeEvent() {
  db.exec(`
    DELETE FROM solves;
    DELETE FROM players;
    DELETE FROM force_unlocks;
    DELETE FROM banned_nicks;
    DELETE FROM announcements;
    DELETE FROM audit_log;
    DELETE FROM meta;
  `);
}

/** Oyuncular kalsın; süre/dalga zorlamaları sıfırlansın → lobi. */
export function resetToLobby(durationMs) {
  db.exec("DELETE FROM solves; DELETE FROM force_unlocks;");
  db.prepare("UPDATE players SET score = 0").run();
  setMeta("startedAt", "0");
  setMeta("frozen", "0");
  setMeta("frozenElapsedMs", "0");
  setMeta("practice", "0");
  if (durationMs) setMeta("durationMs", durationMs);
  return getEvent();
}

export function setPractice(enabled) {
  setMeta("practice", enabled ? "1" : "0");
}

export function isPractice() {
  return getMeta("practice", "0") === "1";
}

export function banNick(nick, reason = "") {
  db.prepare(
    "INSERT INTO banned_nicks (nick, reason, banned_at) VALUES (?, ?, ?) ON CONFLICT(nick) DO UPDATE SET reason = excluded.reason, banned_at = excluded.banned_at"
  ).run(nick, reason || "", Date.now());
}

export function isNickBanned(nick) {
  return Boolean(
    db.prepare("SELECT 1 FROM banned_nicks WHERE nick = ?").get(nick)
  );
}

export function listBannedNicks() {
  return db
    .prepare("SELECT nick, reason, banned_at FROM banned_nicks ORDER BY banned_at DESC")
    .all();
}

export function unbanNick(nick) {
  db.prepare("DELETE FROM banned_nicks WHERE nick = ?").run(nick);
}

export function deletePlayerByNick(nick) {
  const player = getPlayerByNick(nick);
  if (!player) return null;
  db.prepare("DELETE FROM solves WHERE player_id = ?").run(player.id);
  db.prepare("DELETE FROM players WHERE id = ?").run(player.id);
  return player;
}

export function writeAudit(kind, nick, detail) {
  db.prepare(
    "INSERT INTO audit_log (at, kind, nick, detail) VALUES (?, ?, ?, ?)"
  ).run(Date.now(), kind, nick || null, detail || "");
}

export function listAudit(limit = 100) {
  return db
    .prepare(
      "SELECT id, at, kind, nick, detail FROM audit_log ORDER BY id DESC LIMIT ?"
    )
    .all(limit);
}

export function createAnnouncement(text) {
  const info = db
    .prepare("INSERT INTO announcements (text, created_at) VALUES (?, ?)")
    .run(String(text || "").trim(), Date.now());
  return getAnnouncement(info.lastInsertRowid);
}

export function getAnnouncement(id) {
  return (
    db.prepare("SELECT id, text, created_at FROM announcements WHERE id = ?").get(id) ||
    null
  );
}

export function latestAnnouncement() {
  return (
    db
      .prepare(
        "SELECT id, text, created_at FROM announcements ORDER BY id DESC LIMIT 1"
      )
      .get() || null
  );
}

export function listAnnouncements(limit = 20) {
  return db
    .prepare(
      "SELECT id, text, created_at FROM announcements ORDER BY id DESC LIMIT ?"
    )
    .all(limit);
}

export function listAllSolves() {
  return db
    .prepare(
      `SELECT p.nick, s.challenge_id, s.points, s.solved_at
       FROM solves s
       JOIN players p ON p.id = s.player_id
       ORDER BY s.solved_at ASC`
    )
    .all();
}

export function backupDatabase() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(backupDir, `ctf-${stamp}.sqlite`);
  fs.copyFileSync(dbPath, target);
  const files = fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith(".sqlite"))
    .sort()
    .reverse();
  // Son 20 yedeği tut
  for (const name of files.slice(20)) {
    try {
      fs.unlinkSync(path.join(backupDir, name));
    } catch {
      /* ignore */
    }
  }
  return { path: target, name: path.basename(target), count: Math.min(files.length, 20) };
}

export function listBackups() {
  return fs
    .readdirSync(backupDir)
    .filter((name) => name.endsWith(".sqlite"))
    .sort()
    .reverse()
    .map((name) => {
      const full = path.join(backupDir, name);
      const stat = fs.statSync(full);
      return { name, size: stat.size, mtime: stat.mtimeMs };
    });
}

export default db;
