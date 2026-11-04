const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

function wsUrl() {
  const base = API_URL.replace(/^http/, "ws");
  return `${base}/ws`;
}

export function connectRealtime({ onMessage, onStatus } = {}) {
  let socket = null;
  let closed = false;
  let retryMs = 1000;
  let timer = null;

  function cleanup() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    }
    socket = null;
  }

  function connect() {
    if (closed) return;
    cleanup();
    onStatus?.("connecting");
    try {
      socket = new WebSocket(wsUrl());
    } catch {
      onStatus?.("offline");
      timer = setTimeout(connect, retryMs);
      retryMs = Math.min(10000, retryMs * 1.5);
      return;
    }

    socket.onopen = () => {
      retryMs = 1000;
      onStatus?.("online");
    };
    socket.onclose = () => {
      onStatus?.("offline");
      if (!closed) {
        timer = setTimeout(connect, retryMs);
        retryMs = Math.min(10000, retryMs * 1.5);
      }
    };
    socket.onerror = () => {
      onStatus?.("offline");
    };
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch {
        /* ignore */
      }
    };
  }

  connect();

  return () => {
    closed = true;
    cleanup();
  };
}

export function playTone(kind = "ok") {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (kind === "wave") {
      osc.frequency.value = 520;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (kind === "warn") {
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.55);
    } else {
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.2);
    }
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    /* ignore */
  }
}
