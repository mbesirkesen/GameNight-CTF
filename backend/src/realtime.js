import { WebSocketServer } from "ws";

let wss = null;
const clients = new Set();

export function attachRealtime(server) {
  wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (socket) => {
    clients.add(socket);
    socket.send(
      JSON.stringify({
        type: "hello",
        at: Date.now(),
        message: "WS bağlı",
      })
    );
    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => clients.delete(socket));
  });
  return wss;
}

export function broadcast(type, payload = {}) {
  const raw = JSON.stringify({ type, at: Date.now(), ...payload });
  for (const socket of clients) {
    if (socket.readyState === 1) {
      try {
        socket.send(raw);
      } catch {
        clients.delete(socket);
      }
    }
  }
}

export function wsStats() {
  return { clients: clients.size, path: "/ws" };
}
