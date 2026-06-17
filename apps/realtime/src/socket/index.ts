// ─── socket/index.ts ──────────────────────────────────────────────────────────
// Điểm duy nhất đăng ký toàn bộ socket handler.
// server.ts chỉ cần gọi registerSockets(io) — không cần biết bên trong có gì.

import type { Server, Socket } from "socket.io";
import { registerMatchSocket } from "./match.socket";
import { registerPlayerSocket } from "./player.socket";
import { registerNotificationSocket } from "./notification.socket";

export function registerSockets(io: Server): void {
  io.on("connection", (socket: Socket) => {
    // Đăng ký handler theo từng domain
    registerMatchSocket(io, socket);
    registerPlayerSocket(io, socket);
    registerNotificationSocket(io, socket);
  });
}
