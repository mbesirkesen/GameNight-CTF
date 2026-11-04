import "dotenv/config";
import cors from "cors";
import express from "express";
import http from "http";
import { nanoid } from "nanoid";
import {
  CHALLENGE_ICONS,
  flagsMatch,
  getChallenge,
  getStore,
  getUnlockAt,
  listChallenges,
  listWaves,
  loadStore,
  normalizeFlag,
  removeChallenge,
  upsertChallenge,
} from "./challengesStore.js";
import {
  backupDatabase,
  banNick,
  countSolves,
  createAnnouncement,
  createPlayer,
  deletePlayerByNick,
  extendDuration,
  forceUnlock,
  getEvent,
  insertSolve,
  isForceUnlocked,
  isNickBanned,
  isPractice,
  latestAnnouncement,
  listAllSolves,
  listAnnouncements,
  listAudit,
  listBackups,
  listBannedNicks,
  listForceUnlocks,
  listPlayers,
  listSolvesForPlayer,
  prepareEvent,
  recentSolves,
  resetToLobby,
  setFrozen,
  setPractice,
  startEvent,
  getPlayerByNick,
  getPlayerByToken,
  getSolve,
  unbanNick,
  wipeEvent,
  writeAudit,
} from "./db.js";
import { rateLimit } from "./rateLimit.js";
import { attachRealtime, broadcast, wsStats } from "./realtime.js";
import { dynamicPoints, getLevel, PARTICIPANTS } from "./scoring.js";

loadStore();

const PORT = Number(process.env.PORT || 8787);
const ACCESS_CODE = process.env.ACCESS_CODE || "HSD_FIRAT_2026";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin_hsd_2026";
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 3);
const PRACTICE_MINUTES = Number(process.env.PRACTICE_MINUTES || 15);
const START_SCORE = 0;
const NICK_MAX = 18;
const SUBMIT_LIMIT = Number(process.env.SUBMIT_RATE_LIMIT || 30);
const HINT_DELAY_MIN = { Kolay: 8, Orta: 12, Zor: 15 };
const startedAtBoot = Date.now();

const corsOrigin = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const app = express();
const server = http.createServer(app);
attachRealtime(server);

app.use(
  cors({
    origin: corsOrigin.includes("*") ? true : corsOrigin,
  })
);
app.use(express.json({ limit: "256kb" }));

function normalizeAccessCode(value) {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replaceAll("İ", "I")
    .replaceAll("ı", "I");
}

function sanitizeNick(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, NICK_MAX);
}

function isValidNick(value) {
  return /^[A-Za-z0-9ÇĞİÖŞÜçğıöşü_]{3,18}$/.test(sanitizeNick(value));
}

function playElapsed(event, now = Date.now()) {
  if (!event.started || !event.startedAt) return 0;
  if (event.frozen) {
    const stored = Number(event.frozenElapsedMs) || 0;
    if (stored > 0) return Math.min(stored, event.durationMs);
    return Math.min(Math.max(0, now - event.startedAt), event.durationMs);
  }
  return Math.min(Math.max(0, now - event.startedAt), event.durationMs);
}

function remainingMs(event, now = Date.now()) {
  if (!event.started || !event.startedAt) return event.durationMs;
  if (event.frozen) {
    return Math.max(0, event.durationMs - playElapsed(event, now));
  }
  return Math.max(0, event.startedAt + event.durationMs - now);
}

function isOpen(challengeId, elapsedMs) {
  if (isForceUnlocked(challengeId)) return true;
  return elapsedMs >= getUnlockAt(challengeId) * 60 * 1000;
}

function hintReady(challenge, elapsedMs) {
  const unlockMin = getUnlockAt(challenge.id);
  const delay = HINT_DELAY_MIN[challenge.difficulty] ?? 10;
  return elapsedMs >= (unlockMin + delay) * 60 * 1000;
}

function publicChallenge(challenge, elapsedMs, solvedMap = {}) {
  const solves = countSolves(challenge.id);
  const open = isOpen(challenge.id, elapsedMs);
  const solved = Boolean(solvedMap[challenge.id]);
  const current = dynamicPoints(challenge.points, solves);
  const awarded = solvedMap[challenge.id]?.points;
  return {
    id: challenge.id,
    category: challenge.category,
    title: challenge.title,
    initialPoints: challenge.points,
    points: solved ? awarded ?? current : current,
    minutes: challenge.minutes,
    difficulty: challenge.difficulty,
    icon: challenge.icon,
    description: challenge.description,
    story: open ? challenge.story : "",
    hint: open && hintReady(challenge, elapsedMs) ? challenge.hint : null,
    hintReady: open && hintReady(challenge, elapsedMs),
    hintDelayMin: HINT_DELAY_MIN[challenge.difficulty] ?? 10,
    unlockAt: getUnlockAt(challenge.id),
    open,
    solves,
    participants: PARTICIPANTS,
    solved,
    awarded: awarded ?? null,
  };
}

function authPlayer(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.body?.token;
  const player = token ? getPlayerByToken(token) : null;
  if (!player) {
    return res.status(401).json({ error: "Oturum bulunamadı. Tekrar giriş yap." });
  }
  if (isNickBanned(player.nick)) {
    return res.status(403).json({ error: "Bu rumuz yasaklı. Admin ile konuş." });
  }
  req.player = player;
  return next();
}

function authAdmin(req, res, next) {
  const password = req.headers["x-admin-password"] || req.body?.password;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Admin şifresi hatalı." });
  }
  return next();
}

function leaderboard() {
  return listPlayers().map((row, index) => ({
    rank: index + 1,
    nick: row.nick,
    score: row.score,
    solved: row.solved,
    level: getLevel(row.score),
  }));
}

function nextWave(elapsedMs) {
  return listWaves().find((wave) => elapsedMs < wave.at * 60 * 1000) || null;
}

function currentWave(elapsedMs) {
  const waves = listWaves();
  let latest = waves[0];
  for (const wave of waves) {
    if (elapsedMs >= wave.at * 60 * 1000) latest = wave;
  }
  return latest;
}

function eventPayload(event = getEvent()) {
  const elapsed = playElapsed(event);
  return {
    ...event,
    remainingMs: remainingMs(event),
    elapsedMs: event.started ? elapsed : 0,
    currentWave: event.started ? currentWave(elapsed) : null,
    upcoming: event.started ? nextWave(elapsed) : listWaves()[0] || null,
    waiting: !event.started,
    playerCount: listPlayers().length,
    announcement: latestAnnouncement(),
  };
}

function profileStats(playerId) {
  const solves = listSolvesForPlayer(playerId);
  const byCategory = { osint: 0, crypto: 0 };
  for (const row of solves) {
    const challenge = getChallenge(row.challenge_id);
    if (challenge?.category === "crypto") byCategory.crypto += 1;
    else if (challenge) byCategory.osint += 1;
  }
  return {
    solvedCount: solves.length,
    byCategory,
    totalEarned: solves.reduce((sum, row) => sum + row.points, 0),
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

app.get("/api/health", (_req, res) => {
  const event = getEvent();
  res.json({
    ok: true,
    service: "cyber-detectives-backend",
    uptimeMs: Date.now() - startedAtBoot,
    players: listPlayers().length,
    challenges: listChallenges().length,
    started: event.started,
    frozen: event.frozen,
    practice: isPractice(),
    ws: wsStats(),
    env: {
      port: PORT,
      sessionHours: SESSION_HOURS,
      practiceMinutes: PRACTICE_MINUTES,
      submitRateLimit: SUBMIT_LIMIT,
      cors: corsOrigin,
    },
  });
});

app.get("/api/event", (_req, res) => {
  res.json(eventPayload());
});

app.post("/api/session/start", (req, res) => {
  const nick = sanitizeNick(req.body?.nick);
  const code = req.body?.code;

  if (!isValidNick(nick)) {
    return res.status(400).json({
      error: "Rumuz 3-18 karakter olsun. Harf, rakam ve _ kullanılabilir.",
    });
  }
  if (normalizeAccessCode(code) !== normalizeAccessCode(ACCESS_CODE)) {
    writeAudit("login_fail", nick, "bad_code");
    return res.status(403).json({ error: "Kod hatalı. Tekrar dene." });
  }
  if (isNickBanned(nick)) {
    return res.status(403).json({ error: "Bu rumuz yasaklı." });
  }
  if (getPlayerByNick(nick)) {
    return res.status(409).json({
      error: "Bu rumuz alınmış. Başka bir rumuz dene.",
    });
  }

  let event = getEvent();
  if (event.started && remainingMs(event) <= 0) {
    return res.status(403).json({ error: "Oturum süresi dolmuş. Admin gerekir." });
  }
  if (!event.started) {
    const duration = isPractice()
      ? PRACTICE_MINUTES * 60 * 1000
      : SESSION_HOURS * 60 * 60 * 1000;
    event = prepareEvent(duration);
  }

  const player = createPlayer(nanoid(12), nick, nanoid(24), START_SCORE);
  writeAudit("join", nick, event.started ? "live" : "lobby");
  broadcast("player_join", { nick, playerCount: listPlayers().length });

  const waiting = !event.started;
  return res.json({
    token: player.token,
    nick: player.nick,
    score: player.score,
    level: getLevel(player.score),
    started: event.started,
    waiting,
    startedAt: event.startedAt,
    durationMs: event.durationMs,
    remainingMs: remainingMs(event),
    elapsedMs: playElapsed(event),
    playerCount: listPlayers().length,
    announcement: latestAnnouncement(),
    message: waiting
      ? `${nick} · lobidesin · admin oyunu başlatınca sorular açılır`
      : `${nick} · oturum açık · ilk dalga hazır`,
  });
});

app.get("/api/me", authPlayer, (req, res) => {
  const event = getEvent();
  const elapsed = playElapsed(event);
  const live = event.started;
  const solves = listSolvesForPlayer(req.player.id);
  const solvedMap = Object.fromEntries(
    solves.map((row) => [row.challenge_id, row])
  );

  const challenges = listChallenges().map((item) => {
    const pub = publicChallenge(item, elapsed, solvedMap);
    if (!live) return { ...pub, open: false, hintReady: false };
    return pub;
  });

  res.json({
    nick: req.player.nick,
    score: req.player.score,
    level: getLevel(req.player.score),
    profile: profileStats(req.player.id),
    solvedIds: solves.map((row) => row.challenge_id),
    awarded: Object.fromEntries(
      solves.map((row) => [row.challenge_id, row.points])
    ),
    challenges,
    openChallenges: live ? challenges.filter((item) => item.open) : [],
    event: {
      ...eventPayload(event),
      elapsedMs: live ? elapsed : 0,
    },
    announcement: latestAnnouncement(),
    leaderboard: leaderboard(),
    recent: live
      ? recentSolves(8).map((row) => ({
          nick: row.nick,
          challengeId: row.challenge_id,
          title: getChallenge(row.challenge_id)?.title || row.challenge_id,
          points: row.points,
          when: row.solved_at,
        }))
      : [],
    serverTime: Date.now(),
  });
});

app.post("/api/submit", authPlayer, (req, res) => {
  const limit = rateLimit({
    key: `submit:${req.player.id}`,
    limit: SUBMIT_LIMIT,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    writeAudit("rate_limit", req.player.nick, "submit");
    return res.status(429).json({
      error: `Çok hızlı deneme. ${Math.ceil(limit.retryAfterMs / 1000)} sn bekle.`,
    });
  }

  const event = getEvent();
  if (!event.started) {
    return res.status(403).json({ error: "Oturum henüz başlamadı." });
  }
  if (event.frozen) {
    return res.status(403).json({ error: "Oyun admin tarafından donduruldu." });
  }
  if (remainingMs(event) <= 0) {
    return res.status(403).json({ error: "Süre doldu. Yeni bayrak kabul edilmiyor." });
  }

  const challengeId = req.body?.challengeId;
  const flagRaw = String(req.body?.flag || "").trim();
  const challenge = getChallenge(challengeId);
  if (!challenge) {
    return res.status(404).json({ error: "Soru bulunamadı." });
  }

  const elapsed = playElapsed(event);
  if (!isOpen(challengeId, elapsed)) {
    return res.status(403).json({ error: "Bu soru henüz açılmadı." });
  }
  if (getSolve(req.player.id, challengeId)) {
    return res.status(409).json({ error: "Bu soruyu zaten çözdün." });
  }
  if (!flagRaw) {
    return res.status(400).json({ error: "Önce bir bayrak yaz." });
  }
  if (!normalizeFlag(flagRaw)) {
    return res.status(400).json({
      error: "Biçim: CTF{icerik} — harf, rakam ve _ (büyük/küçük harf fark etmez)",
    });
  }
  if (!flagsMatch(flagRaw, challenge.flag)) {
    writeAudit("flag_wrong", req.player.nick, challengeId);
    return res.status(400).json({ error: "Bayrak eşleşmedi." });
  }

  const solvesBefore = countSolves(challengeId);
  const payout = dynamicPoints(challenge.points, solvesBefore);
  insertSolve(req.player.id, challengeId, payout);
  const player = getPlayerByToken(req.player.token);
  writeAudit("flag_ok", req.player.nick, `${challengeId}:+${payout}`);
  broadcast("solve", {
    nick: req.player.nick,
    challengeId,
    title: challenge.title,
    points: payout,
    score: player.score,
  });
  broadcast("leaderboard", { board: leaderboard() });

  return res.json({
    ok: true,
    payout,
    score: player.score,
    level: getLevel(player.score),
    challengeId,
    title: challenge.title,
    leaderboard: leaderboard(),
    profile: profileStats(player.id),
  });
});

app.get("/api/leaderboard", (_req, res) => {
  res.json({ board: leaderboard() });
});

app.post("/api/admin/login", (req, res) => {
  if (req.body?.password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Admin şifresi hatalı." });
  }
  writeAudit("admin_login", "admin", "ok");
  res.json({ ok: true, message: "Admin girişi başarılı." });
});

app.get("/api/admin/overview", authAdmin, (_req, res) => {
  const event = getEvent();
  const elapsed = playElapsed(event);
  res.json({
    event: eventPayload(event),
    health: {
      uptimeMs: Date.now() - startedAtBoot,
      ws: wsStats(),
      backups: listBackups().slice(0, 5),
      auditTail: listAudit(8),
    },
    players: listPlayers().map((row) => ({
      id: row.id,
      nick: row.nick,
      score: row.score,
      solved: row.solved,
      level: getLevel(row.score),
      createdAt: row.created_at,
    })),
    challenges: listChallenges().map((item) => ({
      ...item,
      initialPoints: item.points,
      unlockAt: getUnlockAt(item.id),
      open: event.started ? isOpen(item.id, elapsed) : false,
      forceUnlocked: isForceUnlocked(item.id),
      solves: countSolves(item.id),
      currentPoints: dynamicPoints(item.points, countSolves(item.id)),
    })),
    icons: CHALLENGE_ICONS,
    forceUnlocks: listForceUnlocks(),
    recent: recentSolves(30),
    announcements: listAnnouncements(10),
    banned: listBannedNicks(),
    practice: isPractice(),
    waves: listWaves().map((wave) => {
      const statuses = wave.ids.map((id) => ({
        id,
        open: event.started ? isOpen(id, elapsed) : isForceUnlocked(id),
        forceUnlocked: isForceUnlocked(id),
      }));
      const openCount = statuses.filter((item) => item.open).length;
      return {
        ...wave,
        openCount,
        total: wave.ids.length,
        open: wave.ids.length > 0 && openCount === wave.ids.length,
        statuses,
      };
    }),
  });
});

app.post("/api/admin/challenges", authAdmin, (req, res) => {
  try {
    upsertChallenge(req.body || {}, { isNew: true });
    writeAudit("challenge_create", "admin", req.body?.id || "");
    broadcast("catalog", { action: "create" });
    res.json({ ok: true, store: getStore().challenges.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/admin/challenges/:id", authAdmin, (req, res) => {
  try {
    upsertChallenge({ ...(req.body || {}), id: req.params.id }, { isNew: false });
    writeAudit("challenge_update", "admin", req.params.id);
    broadcast("catalog", { action: "update", id: req.params.id });
    res.json({ ok: true, challenge: getChallenge(req.params.id) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/admin/challenges/:id", authAdmin, (req, res) => {
  try {
    removeChallenge(req.params.id);
    writeAudit("challenge_delete", "admin", req.params.id);
    broadcast("catalog", { action: "delete", id: req.params.id });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/admin/challenges/:id/preview", authAdmin, (req, res) => {
  const challenge = getChallenge(req.params.id);
  if (!challenge) return res.status(404).json({ error: "Soru yok." });
  const event = getEvent();
  const elapsed = playElapsed(event);
  res.json({
    ok: true,
    preview: publicChallenge(challenge, event.started ? elapsed : 0),
    raw: challenge,
  });
});

app.post("/api/admin/unlock", authAdmin, (req, res) => {
  const challengeId = req.body?.challengeId;
  if (!getChallenge(challengeId)) {
    return res.status(404).json({ error: "Soru yok." });
  }
  forceUnlock(challengeId);
  writeAudit("unlock", "admin", challengeId);
  broadcast("unlock", { challengeId });
  res.json({ ok: true, challengeId });
});

app.post("/api/admin/unlock-wave", authAdmin, (req, res) => {
  const at = Number(req.body?.at);
  const wave = listWaves().find((item) => item.at === at);
  if (!wave) return res.status(404).json({ error: "Dalga yok." });
  if (!wave.ids.length) {
    return res.status(400).json({ error: "Bu dalgada soru yok." });
  }
  for (const id of wave.ids) forceUnlock(id);
  writeAudit("unlock_wave", "admin", String(at));
  broadcast("wave", { wave });
  res.json({
    ok: true,
    wave: { ...wave, open: true, openCount: wave.ids.length, total: wave.ids.length },
    unlockedIds: wave.ids,
    message: `${wave.label} açıldı · ${wave.ids.length} soru oyunculara düştü`,
    event: eventPayload(),
  });
});

app.post("/api/admin/start", authAdmin, (req, res) => {
  const before = getEvent();
  if (before.started) {
    return res.status(409).json({
      error: "Oyun zaten başlamış. Lobiye dön veya Her Şeyi Sil.",
      event: eventPayload(before),
    });
  }
  const practice = Boolean(req.body?.practice) || isPractice();
  if (practice) setPractice(true);
  const durationMs = practice
    ? PRACTICE_MINUTES * 60 * 1000
    : SESSION_HOURS * 60 * 60 * 1000;
  const event = startEvent(durationMs);
  writeAudit("start", "admin", practice ? "practice" : "live");
  broadcast("event_start", { event: eventPayload(event), practice });
  res.json({
    ok: true,
    message: practice
      ? `Prova başladı · ${listPlayers().length} oyuncu · ${PRACTICE_MINUTES} dk`
      : `Oyun başladı · ${listPlayers().length} oyuncu · ${SESSION_HOURS} saat`,
    playerCount: listPlayers().length,
    event: eventPayload(event),
  });
});

app.post("/api/admin/practice", authAdmin, (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  setPractice(enabled);
  if (!getEvent().started) {
    prepareEvent(
      enabled ? PRACTICE_MINUTES * 60 * 1000 : SESSION_HOURS * 60 * 60 * 1000
    );
  }
  writeAudit("practice", "admin", enabled ? "on" : "off");
  res.json({
    ok: true,
    practice: enabled,
    message: enabled
      ? `Prova modu açık · süre ${PRACTICE_MINUTES} dk`
      : "Prova modu kapalı · normal 3 saat",
  });
});

app.post("/api/admin/extend", authAdmin, (req, res) => {
  const minutes = Number(req.body?.minutes || 15);
  const event = extendDuration(Math.max(1, minutes) * 60 * 1000);
  writeAudit("extend", "admin", `${minutes}m`);
  broadcast("event", { event: eventPayload(event) });
  res.json({ ok: true, event: eventPayload(event) });
});

app.post("/api/admin/freeze", authAdmin, (req, res) => {
  const frozen = Boolean(req.body?.frozen);
  const event = setFrozen(frozen);
  writeAudit("freeze", "admin", frozen ? "on" : "off");
  broadcast("event", { event: eventPayload(event) });
  res.json({ ok: true, event: eventPayload(event) });
});

app.post("/api/admin/announce", authAdmin, (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (text.length < 2 || text.length > 280) {
    return res.status(400).json({ error: "Duyuru 2-280 karakter olmalı." });
  }
  const row = createAnnouncement(text);
  writeAudit("announce", "admin", text.slice(0, 80));
  broadcast("announce", { announcement: row });
  res.json({ ok: true, announcement: row, message: "Duyuru gönderildi" });
});

app.post("/api/admin/kick", authAdmin, (req, res) => {
  const nick = sanitizeNick(req.body?.nick);
  const ban = req.body?.ban !== false;
  const reason = String(req.body?.reason || "Admin çıkardı").slice(0, 120);
  const removed = deletePlayerByNick(nick);
  if (!removed) return res.status(404).json({ error: "Oyuncu yok." });
  if (ban) banNick(nick, reason);
  writeAudit("kick", nick, ban ? `ban:${reason}` : reason);
  broadcast("kick", { nick, ban });
  broadcast("leaderboard", { board: leaderboard() });
  res.json({
    ok: true,
    nick,
    banned: ban,
    message: ban ? `${nick} atıldı ve yasaklandı` : `${nick} atıldı`,
  });
});

app.post("/api/admin/unban", authAdmin, (req, res) => {
  const nick = sanitizeNick(req.body?.nick);
  unbanNick(nick);
  writeAudit("unban", nick, "");
  res.json({ ok: true, nick, message: `${nick} yasağı kalktı` });
});

app.post("/api/admin/lobby", authAdmin, (_req, res) => {
  const duration = isPractice()
    ? PRACTICE_MINUTES * 60 * 1000
    : SESSION_HOURS * 60 * 60 * 1000;
  const event = resetToLobby(duration);
  writeAudit("lobby_reset", "admin", "");
  broadcast("lobby", { event: eventPayload(event) });
  res.json({
    ok: true,
    message: "Lobiye dönüldü · oyuncular duruyor, skor/süre sıfır",
    event: eventPayload(event),
    players: listPlayers().length,
  });
});

app.post("/api/admin/backup", authAdmin, (_req, res) => {
  const result = backupDatabase();
  writeAudit("backup", "admin", result.name);
  res.json({ ok: true, backup: result, message: `Yedek: ${result.name}` });
});

app.get("/api/admin/export/scores.csv", authAdmin, (_req, res) => {
  const rows = [["rank", "nick", "score", "solved", "level"]];
  leaderboard().forEach((row) => {
    rows.push([row.rank, row.nick, row.score, row.solved, row.level]);
  });
  const csv = rows.map((line) => line.map(csvEscape).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="scores-${Date.now()}.csv"`
  );
  res.send(csv);
});

app.get("/api/admin/export/solves.csv", authAdmin, (_req, res) => {
  const rows = [["nick", "challenge_id", "points", "solved_at"]];
  for (const row of listAllSolves()) {
    rows.push([
      row.nick,
      row.challenge_id,
      row.points,
      new Date(row.solved_at).toISOString(),
    ]);
  }
  const csv = rows.map((line) => line.map(csvEscape).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="solves-${Date.now()}.csv"`
  );
  res.send(csv);
});

app.get("/api/admin/audit", authAdmin, (req, res) => {
  const limit = Math.min(500, Number(req.query.limit) || 100);
  res.json({ ok: true, rows: listAudit(limit) });
});

app.post("/api/admin/wipe", authAdmin, (_req, res) => {
  wipeEvent();
  writeAudit("wipe", "admin", "all");
  broadcast("wipe", {});
  res.json({ ok: true, message: "Tüm oturum verisi silindi." });
});

server.listen(PORT, () => {
  console.log(`CTF backend http://localhost:${PORT}`);
  console.log(`CTF websocket ws://localhost:${PORT}/ws`);
});
