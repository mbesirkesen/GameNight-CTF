#!/usr/bin/env node
/**
 * Baştan sona API duman testi.
 * Çalıştır: node scripts/e2e-smoke.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const WebSocket = require("../backend/node_modules/ws");

const API = process.env.API_URL || "http://localhost:8787";
const ADMIN = process.env.ADMIN_PASSWORD || "admin_hsd_2026";
const CODE = process.env.ACCESS_CODE || "HSD_FIRAT_2026";
const logs = [];
let failed = 0;

function log(ok, name, detail = "") {
  const line = `${ok ? "OK  " : "FAIL"} ${name}${detail ? ` · ${detail}` : ""}`;
  logs.push(line);
  console.log(line);
  if (!ok) failed += 1;
}

async function req(path, { method = "GET", body, admin, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (admin) headers["x-admin-password"] = admin;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

function assert(cond, name, detail) {
  log(Boolean(cond), name, detail);
}

async function main() {
  console.log(`\n=== E2E smoke @ ${API} ===\n`);

  const health = await req("/api/health");
  assert(health.status === 200 && health.data.ok, "health", JSON.stringify(health.data.env || {}));

  const wipe = await req("/api/admin/wipe", { method: "POST", body: {}, admin: ADMIN });
  assert(wipe.status === 200, "wipe");

  const practiceOn = await req("/api/admin/practice", {
    method: "POST",
    body: { enabled: true },
    admin: ADMIN,
  });
  assert(practiceOn.status === 200 && practiceOn.data.practice === true, "practice on");

  const join1 = await req("/api/session/start", {
    method: "POST",
    body: { nick: "smoke_a", code: CODE },
  });
  assert(join1.status === 200 && join1.data.waiting === true, "join lobby A", join1.data.message);
  const tokenA = join1.data.token;

  const join2 = await req("/api/session/start", {
    method: "POST",
    body: { nick: "smoke_b", code: CODE },
  });
  assert(join2.status === 200, "join lobby B");

  const meLobby = await req("/api/me", { token: tokenA });
  assert(
    meLobby.status === 200 &&
      meLobby.data.event.started === false &&
      meLobby.data.openChallenges.length === 0,
    "me lobby: no open challenges"
  );
  assert(meLobby.data.score === 0, "start score 0");

  let wsGot = false;
  await new Promise((resolve) => {
    const ws = new WebSocket(API.replace(/^http/, "ws") + "/ws");
    const t = setTimeout(() => {
      ws.close();
      resolve();
    }, 2500);
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === "event_start" || msg.type === "hello") wsGot = true;
      if (msg.type === "event_start") {
        clearTimeout(t);
        ws.close();
        resolve();
      }
    });
    ws.on("open", async () => {
      await req("/api/admin/start", {
        method: "POST",
        body: { practice: true },
        admin: ADMIN,
      });
    });
    ws.on("error", () => {
      clearTimeout(t);
      resolve();
    });
  });
  assert(wsGot, "websocket receive");

  const meLive = await req("/api/me", { token: tokenA });
  assert(meLive.status === 200 && meLive.data.event.started === true, "event started");
  assert(meLive.data.openChallenges.length > 0, "open challenges after start");

  const announce = await req("/api/admin/announce", {
    method: "POST",
    body: { text: "Smoke duyuru test" },
    admin: ADMIN,
  });
  assert(announce.status === 200, "announce");

  const openId = meLive.data.openChallenges[0].id;
  const wrong = await req("/api/submit", {
    method: "POST",
    token: tokenA,
    body: { challengeId: openId, flag: "CTF{wrong_flag}" },
  });
  assert(wrong.status === 400, "wrong flag rejected");

  // case-insensitive: use real flag from admin overview
  const overview = await req("/api/admin/overview", { admin: ADMIN });
  const challenge = overview.data.challenges.find((c) => c.id === openId);
  const flagUpper = String(challenge.flag).toUpperCase().replace("CTF{", "CTF{");
  const ok = await req("/api/submit", {
    method: "POST",
    token: tokenA,
    body: { challengeId: openId, flag: flagUpper },
  });
  assert(ok.status === 200 && ok.data.payout > 0, "flag accept case-insensitive", `+${ok.data.payout}`);

  const freeze = await req("/api/admin/freeze", {
    method: "POST",
    body: { frozen: true },
    admin: ADMIN,
  });
  assert(freeze.status === 200 && freeze.data.event.frozen === true, "freeze");
  const rem1 = freeze.data.event.remainingMs;
  await new Promise((r) => setTimeout(r, 1200));
  const ov2 = await req("/api/admin/overview", { admin: ADMIN });
  assert(
    ov2.data.event.remainingMs === rem1,
    "freeze keeps remaining",
    `${rem1} vs ${ov2.data.event.remainingMs}`
  );
  await req("/api/admin/freeze", {
    method: "POST",
    body: { frozen: false },
    admin: ADMIN,
  });

  const backup = await req("/api/admin/backup", { method: "POST", body: {}, admin: ADMIN });
  assert(backup.status === 200 && backup.data.backup?.name, "backup");

  const csv = await req("/api/admin/export/scores.csv", { admin: ADMIN });
  assert(csv.status === 200 && String(csv.data).includes("smoke_a"), "scores csv");

  const kick = await req("/api/admin/kick", {
    method: "POST",
    body: { nick: "smoke_b", ban: true },
    admin: ADMIN,
  });
  assert(kick.status === 200, "kick+ban");
  const rejoin = await req("/api/session/start", {
    method: "POST",
    body: { nick: "smoke_b", code: CODE },
  });
  assert(rejoin.status === 403, "banned nick blocked");

  const lobby = await req("/api/admin/lobby", { method: "POST", body: {}, admin: ADMIN });
  assert(lobby.status === 200 && lobby.data.event.started === false, "reset lobby");

  const rateHits = [];
  for (let i = 0; i < 35; i += 1) {
    // recreate live for rate limit test
    if (i === 0) {
      await req("/api/admin/start", { method: "POST", body: { practice: true }, admin: ADMIN });
    }
    const r = await req("/api/submit", {
      method: "POST",
      token: tokenA,
      body: { challengeId: openId, flag: "CTF{spam}" },
    });
    rateHits.push(r.status);
  }
  assert(rateHits.includes(429), "rate limit triggers", rateHits.slice(-5).join(","));

  const preview = await req(`/api/admin/challenges/${openId}/preview`, { admin: ADMIN });
  assert(preview.status === 200 && preview.data.preview?.id === openId, "challenge preview");

  console.log(`\n=== DONE · failures=${failed} ===\n`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error("CRASH", error);
  process.exit(1);
});
