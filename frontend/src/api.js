const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";
const TOKEN_KEY = "ctf-player-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    const error = new Error("Sunucuya ulaşılamıyor. Bağlantını kontrol et.");
    error.code = "OFFLINE";
    throw error;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `İstek başarısız (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export function getApiUrl() {
  return API_URL;
}

export function startRemoteSession({ nick, code }) {
  return request("/api/session/start", {
    method: "POST",
    body: JSON.stringify({ nick, code }),
  });
}

export function fetchMe() {
  return request("/api/me");
}

export function submitRemoteFlag({ challengeId, flag }) {
  return request("/api/submit", {
    method: "POST",
    body: JSON.stringify({ challengeId, flag }),
  });
}

export function fetchLeaderboard() {
  return request("/api/leaderboard");
}

export function fetchEvent() {
  return request("/api/event");
}
