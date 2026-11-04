import { useEffect, useState } from "react";
import {
  Activity,
  Clock,
  Download,
  Eye,
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
import { adminDownload, adminFetch, adminLogin } from "./api.js";

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
  flag: "CTF{}",
  unlockAt: 0,
};

function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
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

  async function refresh() {
    if (!password) return;
    const data = await adminFetch("/api/admin/overview", password);
    setOverview(data);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    try {
      await adminLogin(password);
      sessionStorage.setItem("ctf-admin-pass", password);
      setAuthed(true);
      await refresh();
    } catch (error) {
      setLoginError(error.message);
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
    setEditorMode("create");
    setForm({
      ...EMPTY_FORM,
      icon: overview?.icons?.[0] || "Search",
      id: `custom-${Date.now().toString().slice(-6)}`,
    });
    setEditorOpen(true);
  }

  function openEdit(item) {
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
      flag: item.flag || "CTF{}",
      unlockAt: item.unlockAt || 0,
    });
    setEditorOpen(true);
  }

  async function saveChallenge(event) {
    event.preventDefault();
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
            Oyun gecesi müdahale paneli. Soru ekle, cevap değiştir, dalga aç.
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
          label="Dalga"
          value={
            event?.started
              ? event?.currentWave?.label || "—"
              : "Admin onayı bekleniyor"
          }
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

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
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
          <h2 className="mb-3 flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-cyan-300">
            <Users size={14} />
            SKOR TABLOSU
          </h2>
          <p className="mb-3 text-[11px] text-slate-500">
            Puan yalnızca doğru bayrakla artar. Kick = at + isteğe bağlı yasak.
          </p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-[11px] text-slate-500">
                <tr>
                  <th className="py-1">Rumuz</th>
                  <th>Çözülen</th>
                  <th className="text-right">Puan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(overview?.players || []).map((player) => (
                  <tr key={player.id} className="border-t border-slate-800">
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
            DALGALAR / SORULAR
          </h2>
          <p className="mb-3 text-[11px] text-slate-500">
            “Aç” = bu dalgadaki soruları hemen oyuncuya düşür (süreyi beklemeden).
          </p>
          <ul className="mb-4 space-y-2">
            {(overview?.waves || []).map((wave) => {
              const open = Boolean(wave.open);
              return (
                <li
                  key={wave.at}
                  className={`flex items-center justify-between gap-2 border px-2 py-2 ${
                    open
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-slate-800"
                  }`}
                >
                  <div>
                    <p className="font-mono text-xs text-slate-200">
                      {wave.label}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {wave.at}. dk · {wave.openCount ?? 0}/{wave.total ?? wave.ids.length} açık
                      {open ? " · oyuncuda görünüyor" : ""}
                    </p>
                  </div>
                  <Action
                    disabled={busy || open || !event?.started}
                    onClick={() =>
                      run(() =>
                        adminFetch("/api/admin/unlock-wave", password, {
                          method: "POST",
                          body: JSON.stringify({ at: wave.at }),
                        })
                      )
                    }
                  >
                    {open ? (
                      <span className="inline-flex items-center gap-1 text-green-300">
                        <Unlock size={12} /> Açık
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Unlock size={12} /> Aç
                      </span>
                    )}
                  </Action>
                </li>
              );
            })}
          </ul>

          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="font-mono text-[10px] text-slate-500">
                <tr>
                  <th className="py-1">Soru</th>
                  <th>Bayrak</th>
                  <th>Çözüm</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(overview?.challenges || []).map((item) => (
                  <tr key={item.id} className="border-t border-slate-800">
                    <td className="py-2">
                      <p className="text-slate-200">{item.title}</p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {item.id} · {item.unlockAt}. dk · {item.difficulty}
                      </p>
                    </td>
                    <td className="max-w-[140px] truncate font-mono text-[10px] text-green-300">
                      {item.flag}
                    </td>
                    <td>{item.solves}</td>
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
                        disabled={busy || item.open}
                        onClick={() =>
                          run(
                            () =>
                              adminFetch("/api/admin/unlock", password, {
                                method: "POST",
                                body: JSON.stringify({ challengeId: item.id }),
                              }),
                            `${item.id} açıldı`
                          )
                        }
                        className="inline-flex items-center gap-1 border border-slate-700 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-40"
                      >
                        {item.open ? <Unlock size={10} /> : <Lock size={10} />}
                        {item.open ? "Açık" : "Aç"}
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
            className="my-6 w-full max-w-2xl border border-amber-400/50 bg-slate-900 p-5"
          >
            <h2 className="font-mono text-sm tracking-[0.14em] text-amber-300">
              {editorMode === "create" ? "YENİ SORU" : "SORU DÜZENLE"}
            </h2>
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
              <Field label="Tahmini dk">
                <input
                  type="number"
                  value={form.minutes}
                  onChange={(e) =>
                    setForm({ ...form, minutes: Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Açılış dakikası">
                <input
                  type="number"
                  value={form.unlockAt}
                  onChange={(e) =>
                    setForm({ ...form, unlockAt: Number(e.target.value) })
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
            </Field>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="border border-green-500 px-3 py-2 font-mono text-xs text-green-300"
              >
                [ KAYDET ]
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
