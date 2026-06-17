// ─── middleware/logger.ts ─────────────────────────────────────────────────────
// Log mọi kết nối, sự kiện và ngắt kết nối. Dùng làm Socket.io middleware.

import type { Socket } from "socket.io";

type NextFn = (err?: Error) => void;

export function loggerMiddleware(socket: Socket, next: NextFn): void {
  const { id, handshake } = socket;
  const ip = handshake.headers["x-forwarded-for"] ?? handshake.address;
  const ts = () => new Date().toISOString();

  console.log(`[${ts()}] 🔌 CONNECT   id=${id}  ip=${ip}`);

  // Log từng event do client gửi lên
  socket.onAny((event: string, ...args: unknown[]) => {
    console.log(`[${ts()}] 📨 EVENT     id=${id}  event=${event}`, args.length ? args : "");
  });

  socket.on("disconnect", (reason: string) => {
    console.log(`[${ts()}] ❌ DISCONNECT id=${id}  reason=${reason}`);
  });

  next();
}
