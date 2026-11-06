import { useEffect, useState } from "react";
import {
  Activity,
  Clock,
  Download,
  Eye,
  Lightbulb,
  Lock,
  Megaphone,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Snowflake,
  Trash2,
  Trophy,
  Unlock,
  Users,
} from "lucide-react";
import {
  adminDownload,
  adminFetch,
  adminLogin,
  adminUploadImage,
  mediaUrl,
} from "./api.js";

const EMPTY_FORM = {
  id: "",
  category: "osint",
  title: "",
  points: 100,
  minutes: 15,
  difficulty: "Kolay",
  icon: "Search",
  description: "",
  story: "",
  hint: "",
  imageUrl: "",
  linkUrl: "",
  linkLabel: "",
  decaySolves: 10,
  decayDrop: 50,
  minPoints: 100,
  flag: "",
  unlockAt: 0,
};

function isValidChallengeFlag(value) {
  return /^CTF\{[a-zA-Z0-9_]+\}$/i.test(String(value || "").trim());
}

function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function readHashView() {
  return window.location.hash === "#board" ? "board" : "panel";
}

export default function App() {
  const [password, setPassword] = useState(
    () => sessionStorage.getItem("ctf-admin-pass") || ""
  );
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [overview, setOverview] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("create");
  const [form, setForm] = useState(EMPTY_FORM);
  const [announceText, setAnnounceText] = useState("");
  const [preview, setPreview] = useState(null);
  const [view, setView] = useState(readHashView);

  useEffect(() => {
    const onHash = () => setView(readHashView());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Sadece sayfa açılışında kayıtlı oturumu dene — her tuşta değil
  useEffect(() => {
    const saved = String(sessionStorage.getItem("ctf-admin-pass") || "").trim();
    if (!saved) return undefined;
    let cancelled = false;
    adminLogin(saved)
      .then(async () => {
        if (cancelled) return;
        setPassword(saved);
        setAuthed(true);
        const data = await adminFetch("/api/admin/overview", saved);
        if (!cancelled) setOverview(data);
      })
      .catch((error) => {
        if (cancelled) return;
        sessionStorage.removeItem("ctf-admin-pass");
        setPassword("");
        const msg = String(error?.message || "");
        if (!/şifre|password|hatalı/i.test(msg)) {
          setLoginError(msg || "Backend'e ulaşılamıyor (8787).");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openBoardScreen() {
    const url = `${window.location.pathname}${window.location.search}#board`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function refresh() {
    if (!password) return;
    const data = await adminFetch("/api/admin/overview", password);
    setOverview(data);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    const pass = String(password || "").trim();
    if (!pass) {
      setLoginError("Admin şifresi gerekli.");
      return;
    }
    try {
      await adminLogin(pass);
      sessionStorage.setItem("ctf-admin-pass", pass);
      setPassword(pass);
      setAuthed(true);
      const data = await adminFetch("/api/admin/overview", pass);
      setOverview(data);
    } catch (error) {
      setLoginError(error.message || "Giriş başarısız / backend kapalı olabilir.");
      setAuthed(false);
    }
  }

  useEffect(() => {
    if (!authed) return undefined;
    refresh().catch((error) => setMessage(error.message));
    const timer = setInterval(() => {
      refresh().catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [authed, password]);

  async function run(action, successText) {
    setBusy(true);
    setMessage("");
    try {
      const result = await action();
      await refresh();
      if (successText) {
        setMessage(successText);
      } else if (typeof result === "string" && result) {
        setMessage(result);
      } else if (result?.message) {
        setMessage(result.message);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setMessage("");
    setEditorMode("create");
    setForm({
      ...EMPTY_FORM,
      icon: overview?.icons?.[0] || "Search",
      id: `custom-${Date.now().toString().slice(-6)}`,
    });
    setEditorOpen(true);
  }

  function openEdit(item) {
    setMessage("");
    setEditorMode("edit");
    setForm({
      id: item.id,
      category: item.category,
      title: item.title,
      points: item.points || item.initialPoints,
      minutes: item.minutes || 15,
      difficulty: item.difficulty,
      icon: item.icon || "Search",
      description: item.description || "",
      story: item.story || "",
      hint: item.hint || "",
      imageUrl: item.imageUrl || "",
      linkUrl: item.linkUrl || "",
      linkLabel: item.linkLabel || "",
      decaySolves: item.decaySolves || 10,
      decayDrop: item.decayDrop ?? 50,
      minPoints: item.minPoints || 100,
      flag: item.flag || "",
      unlockAt: item.unlockAt || 0,
    });
    setEditorOpen(true);
  }

  async function saveChallenge(event) {
    event.preventDefault();
    if (!String(form.title || "").trim() || String(form.title || "").trim().length < 3) {
      setMessage("Başlık en az 3 karakter olmalı.");
      return;
    }
    if (!isValidChallengeFlag(form.flag)) {
      setMessage(
        "Bayrak boş olamaz. Örnek: CTF{ornek_cevap} — parantez içi a-z, 0-9, _"
      );
      return;
    }
    if (form.linkUrl.trim()) {
      try {
        const parsed = new URL(form.linkUrl.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          setMessage("Link yalnızca http veya https olmalı.");
          return;
        }
      } catch {
        setMessage("Link URL geçersiz. Boş bırakabilir veya https://... yaz.");
        return;
      }
    }
    await run(async () => {
      if (editorMode === "create") {
        await adminFetch("/api/admin/challenges", password, {
          method: "POST",
          body: JSON.stringify(form),
        });
      } else {
        await adminFetch(`/api/admin/challenges/${form.id}`, password, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      }
      setEditorOpen(false);
    }, editorMode === "create" ? "Soru eklendi" : "Soru güncellendi");
  }

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <form
          onSubmit={handleLogin}
          className="w-full border border-amber-400/60 bg-slate-900/80 p-6"
        >
          <div className="mb-4 flex items-center gap-2 text-amber-300">
            <Shield size={18} />
            <h1 className="font-mono text-sm tracking-[0.16em]">CTF ADMIN</h1>
          </div>
          <p className="text-sm text-slate-400">
            Oyun gecesi müdahale paneli. Soru ekle, aç/kapa, skorları yansıt.
          </p>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Admin şifresi"
            className="mt-4 w-full border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm outline-none focus:border-amber-400"
          />
          {loginError && (
            <p className="mt-2 font-mono text-xs text-rose-400">{loginError}</p>
          )}
          <button
            type="submit"
            className="mt-4 w-full border border-amber-400 py-2 font-mono text-xs tracking-[0.14em] text-amber-200"
          >
            [ GİRİŞ ]
          </button>
        </form>
      </div>
    );
  }

  const event = overview?.event;

  if (view === "board") {
    return (
      <ProjectionBoard
        players={overview?.players || []}
        event={event}
        onBack={() => {
          window.location.hash = "";
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-amber-300">
            CYBER DETECTIVES · ADMIN
          </p>
          <h1 className="mt-1 font-mono text-xl">Kontrol Odası</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Action disabled={busy} onClick={openCreate}>
            <span className="inline-flex items-center gap-1">
              <Plus size={12} /> Soru Ekle
            </span>
          </Action>
          <button
            type="button"
            onClick={openBoardScreen}
            className="inline-flex items-center gap-2 border border-amber-400/70 bg-amber-400/10 px-3 py-2 font-mono text-xs text-amber-100"
          >
            <Trophy size={14} />
            Sıralama ekranı
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(refresh, "Yenilendi")}
            className="inline-flex items-center gap-2 border border-slate-600 px-3 py-2 font-mono text-xs text-slate-300"
          >
            <RefreshCw size={14} />
            Yenile
          </button>
        </div>
      </header>

      {message && (
        <p className="mb-4 border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 font-mono text-xs text-cyan-200">
          {message}
        </p>
      )}

      {!event?.started && (
        <section className="mb-6 border border-amber-400/60 bg-amber-400/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] tracking-[0.16em] text-amber-200">
                LOBİ · OYUN HENÜZ BAŞLAMADI
              </p>
              <p className="mt-1 text-sm text-amber-50/90">
                Oyuncular giriş yapıp bekliyor. Herkes gelince başlat — süre ve
                sorular o anda açılır.
              </p>
              <p className="mt-1 font-mono text-xs text-amber-100/80">
                Lobide {overview?.players?.length ?? 0} oyuncu
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Action
                disabled={busy}
                onClick={() =>
                  run(() =>
                    adminFetch("/api/admin/practice", password, {
                      method: "POST",
                      body: JSON.stringify({
                        enabled: !overview?.practice,
                      }),
                    })
                  )
                }
              >
                {overview?.practice ? "Prova: AÇIK" : "Prova: kapalı"}
              </Action>
              <Action
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      `${overview?.players?.length ?? 0} oyuncu ile ${
                        overview?.practice ? "PROVA" : "oyunu"
                      } başlatmak istiyor musun?`
                    )
                  ) {
                    return;
                  }
                  return run(() =>
                    adminFetch("/api/admin/start", password, {
                      method: "POST",
                      body: JSON.stringify({
                        practice: Boolean(overview?.practice),
                      }),
                    })
                  );
                }}
              >
                <span className="inline-flex items-center gap-2 text-green-300">
                  <Play size={14} /> Oyunu Başlat
                </span>
              </Action>
            </div>
          </div>
        </section>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Clock}
          label={
            !event?.started
              ? "Süre (bekliyor)"
              : event?.frozen
                ? "Kalan süre (DURDU)"
                : "Kalan süre"
          }
          value={
            event
              ? formatClock(
                  event.started ? event.remainingMs || 0 : event.durationMs || 0
                )
              : "--"
          }
        />
        <Stat
          icon={Users}
          label={event?.started ? "Oyuncu" : "Lobide"}
          value={String(overview?.players?.length ?? 0)}
        />
        <Stat
          icon={Trophy}
          label="Açık soru"
          value={String(
            (overview?.challenges || []).filter(
              (item) => item.forceUnlocked || item.open
            ).length
          )}
        />
        <Stat
          icon={Snowflake}
          label="Durum"
          value={
            event?.frozen
              ? "DONDU"
              : event?.started
                ? "CANLI"
                : "LOBİ"
          }
        />
      </section>

      <section className="mb-6 flex flex-wrap gap-2">
        <Action
          disabled={busy || !event?.started}
          onClick={() =>
            run(
              () =>
                adminFetch("/api/admin/extend", password, {
                  method: "POST",
                  body: JSON.stringify({ minutes: 15 }),
                }),
              "+15 dakika eklendi"
            )
          }
        >
          +15 dk
        </Action>
        <Action
          disabled={busy || !event?.started}
          onClick={() =>
            run(
              () =>
                adminFetch("/api/admin/freeze", password, {
                  method: "POST",
                  body: JSON.stringify({ frozen: !event?.frozen }),
                }),
              event?.frozen ? "Oyun devam ediyor" : "Oyun donduruldu"
            )
          }
        >
          {event?.frozen ? "Devam Ettir" : "Dondur"}
        </Action>
        <Action
          disabled={busy || !event?.started}
          onClick={() => {
            if (!window.confirm("Oyuncular kalsın, süre/skor sıfırlansın (lobi)?"))
              return;
            return run(() =>
              adminFetch("/api/admin/lobby", password, {
                method: "POST",
                body: "{}",
              })
            );
          }}
        >
          <span className="inline-flex items-center gap-1">
            <RotateCcw size={12} /> Lobiye Dön
          </span>
        </Action>
        <Action
          disabled={busy}
          onClick={() =>
            run(() =>
              adminFetch("/api/admin/backup", password, {
                method: "POST",
                body: "{}",
              })
            )
          }
        >
          Yedek Al
        </Action>
        <Action
          disabled={busy}
          onClick={() =>
            run(async () => {
              await adminDownload(
                "/api/admin/export/scores.csv",
                password,
                "scores.csv"
              );
              return { message: "Skor CSV indirildi" };
            })
          }
        >
          <span className="inline-flex items-center gap-1">
            <Download size={12} /> Skor CSV
          </span>
        </Action>
        <Action
          disabled={busy}
          onClick={() =>
            run(async () => {
              await adminDownload(
                "/api/admin/export/solves.csv",
                password,
                "solves.csv"
              );
              return { message: "Çözüm CSV indirildi" };
            })
          }
        >
          <span className="inline-flex items-center gap-1">
            <Download size={12} /> Çözüm CSV
          </span>
        </Action>
        <Action
          danger
          disabled={busy}
          onClick={() => {
            if (!window.confirm("Tüm oyuncular ve skorlar silinsin mi?")) return;
            return run(
              () =>
                adminFetch("/api/admin/wipe", password, {
                  method: "POST",
                  body: "{}",
                }),
              "Veriler sıfırlandı"
            );
          }}
        >
          Her Şeyi Sil
        </Action>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="border border-slate-700 bg-slate-900/50 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-cyan-300">
            <Megaphone size={14} />
            CANLI DUYURU
          </h2>
          <textarea
            rows={2}
            value={announceText}
            onChange={(e) => setAnnounceText(e.target.value)}
            placeholder="Örn: 5 dk ara · sonra son dalga"
            className="w-full border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs"
          />
          <Action
            disabled={busy || announceText.trim().length < 2}
            onClick={() =>
              run(async () => {
                const result = await adminFetch("/api/admin/announce", password, {
                  method: "POST",
                  body: JSON.stringify({ text: announceText.trim() }),
                });
                setAnnounceText("");
                return result;
              })
            }
          >
            Duyuru Gönder
          </Action>
        </div>
        <div className="border border-rose-500/50 bg-rose-500/10 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-rose-200">
            <Shield size={14} />
            RED BULL PR
          </h2>
          <p className="mb-3 text-[11px] leading-relaxed text-rose-100/80">
            Oyuncu ekranını anlık hack takeover ile kaplar, süreyi dondurur.
            Bitirince ekranlar ve sayaç geri gelir.
          </p>
          <p className="mb-3 font-mono text-[10px] text-slate-400">
            Durum:{" "}
            {event?.takeover?.active ? (
              <span className="text-rose-300">CANLI TAKEOVER</span>
            ) : (
              <span className="text-slate-500">kapalı</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Action
              disabled={busy || event?.takeover?.active}
              onClick={() => {
                if (
                  !window.confirm(
                    "Red Bull takeover başlasın mı? Oyuncu ekranları kapanır, süre donar."
                  )
                ) {
                  return;
                }
                return run(
                  () =>
                    adminFetch("/api/admin/takeover", password, {
                      method: "POST",
                      body: JSON.stringify({ active: true, freeze: true }),
                    }),
                  "Red Bull takeover AÇIK"
                );
              }}
            >
              Takeover Başlat
            </Action>
            <Action
              danger
              disabled={busy || !event?.takeover?.active}
              onClick={() =>
                run(
                  () =>
                    adminFetch("/api/admin/takeover", password, {
                      method: "POST",
                      body: JSON.stringify({ active: false, freeze: true }),
                    }),
                  "Ekranlar geri · süre devam"
                )
              }
            >
              Ekranı Geri Ver
            </Action>
          </div>
        </div>
        <div className="border border-slate-700 bg-slate-900/50 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-green-300">
            <Activity size={14} />
            SAĞLIK
          </h2>
          <p className="font-mono text-[11px] text-slate-400">
            WS: {overview?.health?.ws?.clients ?? 0} istemci · uptime{" "}
            {formatClock(overview?.health?.uptimeMs || 0)}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            Yedek: {overview?.health?.backups?.[0]?.name || "yok"}
          </p>
          <ul className="mt-2 max-h-24 overflow-auto space-y-1">
            {(overview?.health?.auditTail || []).map((row) => (
              <li key={row.id} className="font-mono text-[10px] text-slate-500">
                {row.kind}
                {row.nick ? ` · ${row.nick}` : ""} · {row.detail}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-slate-700 bg-slate-900/50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-cyan-300">
              <Users size={14} />
              SKOR TABLOSU
            </h2>
            <button
              type="button"
              onClick={openBoardScreen}
              className="inline-flex items-center gap-1 border border-amber-400/50 px-2 py-1 font-mono text-[10px] text-amber-200"
            >
              <Trophy size={12} /> Yansıt
            </button>
          </div>
          <p className="mb-3 text-[11px] text-slate-500">
            Puan yalnızca doğru bayrakla artar. Yansıt = sadece sıralama (projeksiyon).
          </p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-[11px] text-slate-500">
                <tr>
                  <th className="py-1">#</th>
                  <th>Rumuz</th>
                  <th>Çözülen</th>
                  <th className="text-right">Puan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(overview?.players || []).map((player, index) => (
                  <tr key={player.id} className="border-t border-slate-800">
                    <td className="py-2 text-slate-500">{index + 1}</td>
                    <td className="py-2 font-mono text-cyan-200">{player.nick}</td>
                    <td>{player.solved}</td>
                    <td className="text-right text-green-400">{player.score}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`${player.nick} atılsın ve yasaklansın mı?`))
                            return;
                          return run(() =>
                            adminFetch("/api/admin/kick", password, {
                              method: "POST",
                              body: JSON.stringify({
                                nick: player.nick,
                                ban: true,
                              }),
                            })
                          );
                        }}
                        className="border border-rose-500/40 px-2 py-0.5 font-mono text-[10px] text-rose-300"
                      >
                        Kick
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(overview?.banned || []).length > 0 && (
            <div className="mt-3 border-t border-slate-800 pt-2">
              <p className="font-mono text-[10px] text-slate-500">YASAKLI</p>
              <ul className="mt-1 space-y-1">
                {overview.banned.map((row) => (
                  <li
                    key={row.nick}
                    className="flex items-center justify-between gap-2 font-mono text-[11px] text-rose-200"
                  >
                    <span>{row.nick}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          adminFetch("/api/admin/unban", password, {
                            method: "POST",
                            body: JSON.stringify({ nick: row.nick }),
                          })
                        )
                      }
                      className="border border-slate-600 px-2 py-0.5 text-[10px] text-slate-300"
                    >
                      Aç
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="border border-slate-700 bg-slate-900/50 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-amber-300">
            <Unlock size={14} />
            SORULAR
          </h2>
          <p className="mb-3 text-[11px] text-slate-500">
            Yeni soru eklenince kapalı düşer. Oyuncuya düşürmek için “Aç”a bas.
          </p>

          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="font-mono text-[10px] text-slate-500">
                <tr>
                  <th className="py-1">Soru</th>
                  <th>Bayrak</th>
                  <th>Çözüm</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(overview?.challenges || []).map((item) => (
                  <tr key={item.id} className="border-t border-slate-800">
                    <td className="py-2">
                      <p className="text-slate-200">{item.title}</p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {item.id} · {item.difficulty} · her{" "}
                        {item.decaySolves || 10} çözüm −{item.decayDrop ?? 50} ·
                        min {item.minPoints || 100}
                      </p>
                    </td>
                    <td className="max-w-[140px] truncate font-mono text-[10px] text-green-300">
                      {item.flag}
                    </td>
                    <td>{item.solves}</td>
                    <td className="font-mono text-[10px]">
                      <div>
                        {item.forceUnlocked || item.open ? (
                          <span className="text-green-400">Soru açık</span>
                        ) : (
                          <span className="text-amber-300">Soru kapalı</span>
                        )}
                      </div>
                      <div>
                        {item.hintUnlocked ? (
                          <span className="text-cyan-300">İpucu açık</span>
                        ) : (
                          <span className="text-slate-500">İpucu kapalı</span>
                        )}
                      </div>
                    </td>
                    <td className="space-x-1 whitespace-nowrap text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openEdit(item)}
                        className="inline-flex items-center gap-1 border border-slate-700 px-2 py-1 text-[10px] text-cyan-300"
                      >
                        <Pencil size={10} />
                        Düzenle
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const data = await adminFetch(
                              `/api/admin/challenges/${item.id}/preview`,
                              password
                            );
                            setPreview(data);
                            return { message: `Önizleme: ${item.id}` };
                          })
                        }
                        className="inline-flex items-center gap-1 border border-slate-700 px-2 py-1 text-[10px] text-amber-200"
                      >
                        <Eye size={10} />
                        Önizle
                      </button>
                      <button
                        type="button"
                        disabled={busy || item.forceUnlocked || item.open}
                        onClick={() =>
                          run(
                            () =>
                              adminFetch("/api/admin/unlock", password, {
                                method: "POST",
                                body: JSON.stringify({ challengeId: item.id }),
                              }),
                            `${item.id} oyuncuya açıldı`
                          )
                        }
                        className="inline-flex items-center gap-1 border border-slate-700 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-40"
                      >
                        {item.forceUnlocked || item.open ? (
                          <Unlock size={10} />
                        ) : (
                          <Lock size={10} />
                        )}
                        {item.forceUnlocked || item.open ? "Açık" : "Aç"}
                      </button>
                      <button
                        type="button"
                        disabled={
                          busy ||
                          item.hintUnlocked ||
                          !(item.forceUnlocked || item.open)
                        }
                        onClick={() =>
                          run(
                            () =>
                              adminFetch("/api/admin/unlock-hint", password, {
                                method: "POST",
                                body: JSON.stringify({ challengeId: item.id }),
                              }),
                            `${item.id} ipucu açıldı`
                          )
                        }
                        className="inline-flex items-center gap-1 border border-amber-400/40 px-2 py-1 text-[10px] text-amber-200 disabled:opacity-40"
                        title={
                          !(item.forceUnlocked || item.open)
                            ? "Önce soruyu aç"
                            : item.hintUnlocked
                              ? "İpucu zaten açık"
                              : "İpucunu oyuncuya aç"
                        }
                      >
                        <Lightbulb size={10} />
                        {item.hintUnlocked ? "İpucu açık" : "İpucu aç"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`${item.id} silinsin mi?`)) return;
                          return run(
                            () =>
                              adminFetch(`/api/admin/challenges/${item.id}`, password, {
                                method: "DELETE",
                              }),
                            "Soru silindi"
                          );
                        }}
                        className="inline-flex items-center gap-1 border border-rose-500/50 px-2 py-1 text-[10px] text-rose-300"
                      >
                        <Trash2 size={10} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={saveChallenge}
            noValidate
            className="my-6 w-full max-w-2xl border border-amber-400/50 bg-slate-900 p-5"
          >
            <h2 className="font-mono text-sm tracking-[0.14em] text-amber-300">
              {editorMode === "create" ? "YENİ SORU" : "SORU DÜZENLE"}
            </h2>
            {message && (
              <p className="mt-3 border border-rose-500/50 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-200">
                {message}
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="ID">
                <input
                  required
                  disabled={editorMode === "edit"}
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Başlık">
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Kategori">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={inputClass}
                >
                  <option value="osint">osint</option>
                  <option value="crypto">crypto</option>
                </select>
              </Field>
              <Field label="Zorluk">
                <select
                  value={form.difficulty}
                  onChange={(e) =>
                    setForm({ ...form, difficulty: e.target.value })
                  }
                  className={inputClass}
                >
                  <option>Kolay</option>
                  <option>Orta</option>
                  <option>Zor</option>
                </select>
              </Field>
              <Field label="Başlangıç puanı">
                <input
                  type="number"
                  value={form.points}
                  onChange={(e) =>
                    setForm({ ...form, points: Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Tahmini süre (dk, oyuncuya görünür)">
                <input
                  type="number"
                  value={form.minutes}
                  onChange={(e) =>
                    setForm({ ...form, minutes: Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="İkon">
                <select
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  className={inputClass}
                >
                  {(overview?.icons || ["Search"]).map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-3 border border-amber-400/30 bg-amber-400/5 p-3">
              <p className="mb-3 font-mono text-[10px] tracking-[0.14em] text-amber-200">
                DİNAMİK PUAN
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
                <label className="block">
                  <span className="mb-1 block min-h-[2.5rem] font-mono text-[10px] leading-snug tracking-[0.08em] text-slate-400">
                    Her kaç çözümde
                    <br />
                    bir düşsün?
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={form.decaySolves}
                    onChange={(e) =>
                      setForm({ ...form, decaySolves: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block min-h-[2.5rem] font-mono text-[10px] leading-snug tracking-[0.08em] text-slate-400">
                    O adımda kaç
                    <br />
                    puan düşsün?
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={form.decayDrop}
                    onChange={(e) =>
                      setForm({ ...form, decayDrop: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block min-h-[2.5rem] font-mono text-[10px] leading-snug tracking-[0.08em] text-slate-400">
                    Minimum puan
                    <br />
                    (altına inmez)
                  </span>
                  <input
                    type="number"
                    min={50}
                    value={form.minPoints}
                    onChange={(e) =>
                      setForm({ ...form, minPoints: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                </label>
              </div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed text-slate-400">
                Her {form.decaySolves || 10} çözümde −{form.decayDrop || 0} puan.
                {(() => {
                  const start = Number(form.points) || 0;
                  const step = Math.max(1, Number(form.decaySolves) || 10);
                  const drop = Number(form.decayDrop) || 0;
                  const floor = Number(form.minPoints) || 50;
                  const chain = [];
                  let value = start;
                  chain.push(value);
                  while (value > floor && drop > 0 && chain.length < 8) {
                    value = Math.max(floor, value - drop);
                    chain.push(value);
                    if (value <= floor) break;
                  }
                  return (
                    <>
                      {" "}
                      Örnek ({start} başlangıç): {chain.join(" → ")}
                      {chain[chain.length - 1] > floor ? " → …" : ""}.
                    </>
                  );
                })()}
              </p>
            </div>
            <Field label="Kısa açıklama" className="mt-3">
              <input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className={inputClass}
              />
            </Field>
            <Field label="Hikâye / soru metni" className="mt-3">
              <textarea
                rows={6}
                value={form.story}
                onChange={(e) => setForm({ ...form, story: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="İpucu" className="mt-3">
              <textarea
                rows={2}
                value={form.hint}
                onChange={(e) => setForm({ ...form, hint: e.target.value })}
                className={inputClass}
              />
            </Field>
            <div className="mt-3 space-y-3">
              <Field label="Foto (opsiyonel) · dosya yükle veya URL">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      return run(async () => {
                        const result = await adminUploadImage(password, file);
                        setForm((current) => ({
                          ...current,
                          imageUrl: result.imageUrl,
                        }));
                        return result;
                      });
                    }}
                    className="max-w-full font-mono text-[11px] text-slate-300 file:mr-2 file:border file:border-cyan-500/50 file:bg-cyan-500/10 file:px-2 file:py-1 file:font-mono file:text-[10px] file:text-cyan-200"
                  />
                  {form.imageUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, imageUrl: "" })}
                      className="border border-slate-600 px-2 py-1 font-mono text-[10px] text-slate-400"
                    >
                      Foto kaldır
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm({ ...form, imageUrl: e.target.value })
                  }
                  placeholder="yüklenen yol veya https://..."
                  className={`${inputClass} mt-2`}
                  inputMode="url"
                  autoComplete="off"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Link URL (opsiyonel)">
                  <input
                    type="text"
                    value={form.linkUrl}
                    onChange={(e) =>
                      setForm({ ...form, linkUrl: e.target.value })
                    }
                    placeholder="https://..."
                    className={inputClass}
                    inputMode="url"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Link yazısı (opsiyonel)">
                  <input
                    value={form.linkLabel}
                    onChange={(e) =>
                      setForm({ ...form, linkLabel: e.target.value })
                    }
                    placeholder="Kaynağı aç"
                    disabled={!form.linkUrl.trim()}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
            {(form.imageUrl.trim() || form.linkUrl.trim()) && (
              <div className="mt-3 border border-slate-700 bg-slate-950/70 p-3">
                <p className="mb-2 font-mono text-[10px] tracking-[0.14em] text-slate-500">
                  MEDYA ÖNİZLEME
                </p>
                {form.imageUrl.trim() && (
                  <img
                    src={mediaUrl(form.imageUrl.trim())}
                    alt="Soru görseli"
                    className="mb-2 max-h-40 w-full object-contain"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                )}
                {form.linkUrl.trim() && (
                  <a
                    href={form.linkUrl.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-cyan-300 underline"
                  >
                    {form.linkLabel.trim() || form.linkUrl.trim()}
                  </a>
                )}
              </div>
            )}
            <Field
              label="Bayrak (cevap) · CTF{icerik}, büyük/küçük harf fark etmez"
              className="mt-3"
            >
              <input
                required
                value={form.flag}
                onChange={(e) => setForm({ ...form, flag: e.target.value })}
                className={`${inputClass} text-green-300`}
                placeholder="CTF{ornek_cevap}"
              />
              <p className="mt-1 font-mono text-[10px] text-slate-500">
                {"CTF{} tek başına geçersiz — parantezin içine içerik yaz (örn. CTF{gizli_kod})."}
              </p>
            </Field>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="border border-green-500 px-3 py-2 font-mono text-xs text-green-300"
              >
                {busy ? "[ KAYDEDİLİYOR… ]" : "[ KAYDET ]"}
              </button>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="border border-slate-600 px-3 py-2 font-mono text-xs text-slate-300"
              >
                [ VAZGEÇ ]
              </button>
            </div>
          </form>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="my-6 w-full max-w-2xl border border-cyan-500/50 bg-slate-900 p-5">
            <h2 className="font-mono text-sm tracking-[0.14em] text-cyan-300">
              OYUNCU ÖNİZLEME · {preview.raw?.id}
            </h2>
            <p className="mt-2 font-mono text-lg text-slate-100">
              {preview.preview?.title}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {preview.preview?.description}
            </p>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
              {preview.preview?.story || "(kapalı — hikâye görünmez)"}
            </pre>
            {(preview.preview?.imageUrl || preview.raw?.imageUrl) && (
              <img
                src={mediaUrl(
                  preview.preview?.imageUrl || preview.raw?.imageUrl
                )}
                alt=""
                className="mt-3 max-h-48 w-full border border-slate-800 object-contain"
              />
            )}
            {(preview.preview?.linkUrl || preview.raw?.linkUrl) && (
              <a
                href={preview.preview?.linkUrl || preview.raw?.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block font-mono text-xs text-cyan-300 underline"
              >
                {preview.preview?.linkLabel ||
                  preview.raw?.linkLabel ||
                  preview.preview?.linkUrl ||
                  preview.raw?.linkUrl}
              </a>
            )}
            <p className="mt-2 font-mono text-xs text-green-300">
              Bayrak (admin): {preview.raw?.flag}
            </p>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="mt-4 border border-slate-600 px-3 py-2 font-mono text-xs text-slate-300"
            >
              [ KAPAT ]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-amber-400";

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block font-mono text-[10px] tracking-[0.12em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="border border-slate-700 bg-slate-900/60 p-3">
      <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-slate-500">
        <Icon size={12} />
        {label}
      </p>
      <p className="mt-2 font-mono text-sm text-slate-100">{value}</p>
    </div>
  );
}

function Action({ children, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border px-3 py-1.5 font-mono text-[11px] tracking-wide disabled:opacity-50 ${
        danger
          ? "border-rose-500 text-rose-300"
          : "border-slate-600 text-slate-200 hover:border-cyan-500/60"
      }`}
    >
      {children}
    </button>
  );
}

const BOARD_RAIN_GLYPHS =
  "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンﾊﾋﾌﾍﾎｱｲｳｴｵ01ctf{}[]<>/\\|░▒▓█#$@%&*+-_xX0F1A2B3C4D5E6789";

function buildRainColumns(count = 42) {
  return Array.from({ length: count }, (_, col) => {
    const len = 22 + ((col * 11) % 20);
    const chars = Array.from({ length: len }, (_, row) => {
      const idx = (col * 19 + row * 23 + row * row) % BOARD_RAIN_GLYPHS.length;
      return BOARD_RAIN_GLYPHS[idx];
    });
    const tone = col % 9;
    const palette =
      tone === 0
        ? { trail: "#4ade80", glow: "rgba(74,222,128,0.55)" }
        : tone === 1 || tone === 2
          ? { trail: "#fbbf24", glow: "rgba(251,191,36,0.45)" }
          : { trail: "#22d3ee", glow: "rgba(34,211,238,0.55)" };
    return {
      id: col,
      chars,
      left: `${(col / (count - 1)) * 100}%`,
      delay: `${-((col * 1.37) % 22)}s`,
      duration: `${18 + (col % 8) * 2.4}s`,
      flicker: `${2.4 + (col % 5) * 0.55}s`,
      fontSize: `${13 + (col % 5) * 2}px`,
      opacity: 0.28 + (col % 6) * 0.07,
      ...palette,
    };
  });
}

const BOARD_RAIN = buildRainColumns(44);

function rankMeta(index) {
  if (index === 0) {
    return {
      row: "border-amber-300/50 bg-gradient-to-r from-amber-400/25 via-amber-500/10 to-transparent shadow-[0_0_40px_rgba(251,191,36,0.18)]",
      rank: "text-amber-300",
      score: "text-amber-200",
      badge: "★",
    };
  }
  if (index === 1) {
    return {
      row: "border-slate-300/35 bg-gradient-to-r from-slate-200/15 via-slate-400/5 to-transparent",
      rank: "text-slate-200",
      score: "text-cyan-200",
      badge: "◆",
    };
  }
  if (index === 2) {
    return {
      row: "border-orange-500/40 bg-gradient-to-r from-orange-700/30 via-orange-900/10 to-transparent",
      rank: "text-orange-300",
      score: "text-orange-200",
      badge: "▲",
    };
  }
  return {
    row: "border-cyan-500/10 bg-slate-950/35 hover:bg-slate-900/50",
    rank: "text-slate-500",
    score: "text-cyan-300",
    badge: "",
  };
}

function BoardRain() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(2,6,23,0.55)_100%)]" />
      {BOARD_RAIN.map((col) => (
        <div
          key={col.id}
          className="board-rain-col board-font-mono absolute top-0 flex flex-col items-center leading-[1.15]"
          style={{
            left: col.left,
            animationDelay: `${col.delay}, ${col.delay}`,
            animationDuration: `${col.duration}, ${col.flicker}`,
            opacity: col.opacity,
            fontSize: col.fontSize,
            color: col.trail,
            textShadow: `0 0 8px ${col.glow}, 0 0 18px ${col.glow}`,
            transform: "translateX(-50%)",
          }}
        >
          {col.chars.map((ch, row) => {
            const fromHead = col.chars.length - 1 - row;
            const isHead = fromHead === 0;
            const fade = Math.max(0.18, 1 - fromHead / (col.chars.length * 0.92));
            return (
              <span
                key={`${col.id}-${row}`}
                className={isHead ? "board-rain-head" : undefined}
                style={{
                  opacity: isHead ? 1 : fade,
                  color: isHead ? undefined : col.trail,
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ProjectionBoard({ players, event, onBack }) {
  const live = Boolean(event?.started);
  const frozen = Boolean(event?.frozen);
  const [clockMs, setClockMs] = useState(() =>
    Math.max(0, Number(event?.remainingMs) || 0)
  );

  useEffect(() => {
    const synced = Math.max(0, Number(event?.remainingMs) || 0);
    setClockMs(synced);
    if (!live || frozen) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setClockMs(Math.max(0, synced - elapsed));
    }, 250);
    return () => clearInterval(timer);
  }, [event?.remainingMs, event?.frozen, event?.startedAt, live, frozen]);

  const remaining = formatClock(clockMs);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-slate-100">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -15%, rgba(34,211,238,0.22), transparent 58%), radial-gradient(ellipse 50% 40% at 15% 85%, rgba(245,158,11,0.12), transparent 55%), radial-gradient(ellipse 45% 35% at 90% 70%, rgba(14,165,233,0.14), transparent 50%), linear-gradient(180deg, #04101c 0%, #020617 45%, #000 100%)",
        }}
      />
      <div className="board-glow-pulse pointer-events-none absolute left-1/2 top-[-8%] h-[28vh] w-[70vw] -translate-x-1/2 rounded-full bg-cyan-400/25" />
      <div className="board-glow-pulse pointer-events-none absolute bottom-[-10%] right-[-5%] h-[32vh] w-[42vw] rounded-full bg-amber-400/15 [animation-delay:1.4s]" />

      <BoardRain />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.7) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div className="board-scanline pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-transparent via-cyan-300/10 to-transparent" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.35) 3px)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-7 sm:px-10 sm:py-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 board-font-mono text-[11px] tracking-[0.28em] text-cyan-200">
              <span className="board-live-dot inline-block h-2 w-2 rounded-full bg-cyan-300" />
              {live ? "CANLI YAYIN" : "LOBİ MODU"}
            </div>
            <p className="board-font-mono text-xs tracking-[0.35em] text-cyan-300/90 sm:text-sm">
              CYBER DETECTIVES
            </p>
            <h1 className="board-font-display board-title-shimmer mt-2 text-5xl font-extrabold tracking-[0.12em] sm:text-7xl">
              SIRALAMA
            </h1>
            <p className="mt-3 board-font-mono text-sm text-slate-400">
              {live
                ? "Final sürprizi · skorlar yalnızca burada"
                : "Oyun başlamadan önce hazırlık skorları"}
            </p>
          </div>
          <div className="min-w-[11rem] border border-cyan-400/30 bg-slate-950/55 px-5 py-4 text-right shadow-[0_0_40px_rgba(34,211,238,0.12)] backdrop-blur-md">
            <p className="board-font-mono text-[11px] tracking-[0.22em] text-slate-500">
              KALAN SÜRE
            </p>
            <p className="board-font-display mt-1 text-4xl tracking-wider text-cyan-300 sm:text-5xl">
              {live ? remaining : "—:—:—"}
            </p>
            <p className="mt-3 board-font-mono text-xs text-slate-400">
              {players.length} oyuncu
            </p>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden border border-cyan-400/25 bg-slate-950/55 shadow-[0_0_60px_rgba(8,47,73,0.45)] backdrop-blur-md">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
          <div className="grid grid-cols-[5rem_minmax(0,1fr)_6.5rem_7.5rem] gap-2 border-b border-cyan-500/20 px-4 py-3 board-font-mono text-[11px] tracking-[0.2em] text-slate-500 sm:grid-cols-[6rem_minmax(0,1fr)_8rem_9rem] sm:px-6 sm:text-xs">
            <span>SIRA</span>
            <span>OYUNCU</span>
            <span className="text-right">ÇÖZÜLEN</span>
            <span className="text-right">PUAN</span>
          </div>
          <ol className="min-h-0 flex-1 overflow-auto">
            {players.length === 0 && (
              <li className="px-6 py-24 text-center board-font-mono text-sm text-slate-500">
                Henüz oyuncu yok — yağmur bekliyor.
              </li>
            )}
            {players.map((player, index) => {
              const meta = rankMeta(index);
              const podium = index < 3;
              return (
                <li
                  key={player.id}
                  className={`board-row-enter grid grid-cols-[5rem_minmax(0,1fr)_6.5rem_7.5rem] items-center gap-2 border-b border-slate-800/70 px-4 sm:grid-cols-[6rem_minmax(0,1fr)_8rem_9rem] sm:px-6 ${
                    podium ? "py-4 sm:py-5" : "py-3.5 sm:py-4"
                  } ${meta.row}`}
                  style={{ animationDelay: `${index * 55}ms` }}
                >
                  <span
                    className={`board-font-display flex items-center gap-2 ${
                      podium ? "text-2xl sm:text-3xl" : "text-lg sm:text-2xl"
                    } ${meta.rank}`}
                  >
                    #{index + 1}
                    {meta.badge ? (
                      <span className="board-font-mono text-base opacity-90">
                        {meta.badge}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`truncate tracking-wide text-white ${
                      podium
                        ? "board-font-display text-xl sm:text-3xl"
                        : "board-font-mono text-lg sm:text-2xl"
                    }`}
                  >
                    {player.nick}
                  </span>
                  <span className="text-right board-font-mono text-base text-slate-300 sm:text-xl">
                    {player.solved}
                  </span>
                  <span
                    className={`text-right board-font-display ${
                      podium ? "text-2xl sm:text-3xl" : "text-lg sm:text-2xl"
                    } ${meta.score}`}
                  >
                    {player.score}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="absolute right-5 top-5 border border-slate-700/80 bg-slate-950/70 px-2 py-1 board-font-mono text-[10px] text-slate-500 opacity-35 transition hover:opacity-100 sm:right-10 sm:top-8"
        >
          Panele dön
        </button>
      </div>
    </div>
  );
}
