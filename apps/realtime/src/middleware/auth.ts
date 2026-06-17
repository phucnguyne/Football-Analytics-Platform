// ─── middleware/auth.ts ───────────────────────────────────────────────────────
// Xác thực JWT token gửi kèm khi client kết nối.
// Client phải gửi: io("http://localhost:3001", { auth: { token: "<jwt>" } })

import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";
import { env } from "../config/env";

type NextFn = (err?: Error) => void;

export interface AuthPayload {
  sub: string;   // user id
  name?: string;
  email?: string;
}

// Gán thông tin user vào socket để các handler dùng lại
declare module "socket.io" {
  interface Socket {
    user?: AuthPayload;
  }
}

export function authMiddleware(socket: Socket, next: NextFn): void {
  const token =
    (socket.handshake.auth as Record<string, string>)?.token ??
    (socket.handshake.headers["authorization"] ?? "").replace("Bearer ", "");

  if (!token) {
    // Cho phép kết nối ẩn danh — các handler sẽ tự kiểm soát quyền truy cập
    return next();
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    socket.user = payload;
    next();
  } catch {
    next(new Error("Authentication failed: invalid or expired token"));
  }
}
