// ─── config/socket.ts ────────────────────────────────────────────────────────
// Tạo và export instance Socket.io Server với cấu hình CORS, transport, v.v.

import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { env } from "./env";

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.webUrl,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Cho phép cả polling lẫn websocket để hỗ trợ mọi client
    transports: ["polling", "websocket"],
    // Tự động nâng cấp từ polling → websocket
    allowUpgrades: true,
    // Ping mỗi 25s, ngắt sau 60s không phản hồi
    pingInterval: 25_000,
    pingTimeout: 60_000,
  });

  return io;
}
