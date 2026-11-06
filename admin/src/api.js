// Boş string = aynı origin (nginx / Docker). unset → local backend.
const API_URL =
  import.meta.env.VITE_API_URL !== undefined
    ? String(import.meta.env.VITE_API_URL)
    : "http://localhost:8787";

export async function adminLogin(password) {
  let res;
  try {
    res = await fetch(`${API_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: String(password || "").trim() }),
    });
  } catch {
    throw new Error("Backend'e ulaşılamıyor. Sunucu / Docker ayakta mı?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Giriş başarısız");
  return data;
}

export function getApiUrl() {
  return API_URL;
}

/** Göreli /uploads/... yollarını API köküne bağlar. */
export function mediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${API_URL}${raw}`;
  return raw;
}

export async function adminFetch(path, password, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": password,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "İstek başarısız");
  return data;
}

export async function adminUploadImage(password, file) {
  const body = new FormData();
  body.append("image", file);
  const res = await fetch(`${API_URL}/api/admin/upload`, {
    method: "POST",
    headers: { "x-admin-password": password },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Yükleme başarısız");
  return data;
}

export async function adminDownload(path, password, filename) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "x-admin-password": password },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "İndirme başarısız");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
