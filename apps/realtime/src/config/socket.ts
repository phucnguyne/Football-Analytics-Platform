// ─── config/socket.ts ────────────────────────────────────────────────────────
// Tạo và export instance Socket.io Server với cấu hình CORS, transport, v.v.

import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { env } from "./env";
import type { RedisConnections } from "./redis";

export function createSocketServer(
  httpServer: HttpServer,
  redisConnections: RedisConnections | null,
): Server {
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

  if (redisConnections) {
    io.adapter(
      createAdapter(redisConnections.pubClient, redisConnections.subClient),
    );
  }

  return io;
}
