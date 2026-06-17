// ─── server.ts ────────────────────────────────────────────────────────────────
// Entry point của realtime server. Chỉ làm 1 việc: khởi động HTTP + Socket.io.
// Business logic KHÔNG nằm ở đây.

import express from "express";
import { createServer } from "http";

import { env } from "./config/env";
import { createSocketServer } from "./config/socket";
import { authMiddleware } from "./middleware/auth";
import { loggerMiddleware } from "./middleware/logger";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { registerSockets } from "./socket";
import { seedDemoMatch } from "./service/match.service";

// ── HTTP app (chỉ dùng để tạo httpServer, không cần route) ──────────────────
const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

const httpServer = createServer(app);

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = createSocketServer(httpServer);

// Middleware chạy theo thứ tự: auth → logger → rateLimit
io.use(authMiddleware);
io.use(loggerMiddleware);
io.use(rateLimitMiddleware({ maxEvents: 30, windowMs: 10_000 }));

// Đăng ký tất cả event handler
registerSockets(io);

// ── Khởi động ─────────────────────────────────────────────────────────────────
httpServer.listen(env.port, () => {
  console.log(`🚀 Realtime server running on http://localhost:${env.port}`);
  console.log(`   ENV: ${env.nodeEnv}`);
  console.log(`   CORS origin: ${env.webUrl}`);
});

// Seed dữ liệu demo khi dev
if (env.isDev) {
  seedDemoMatch();
  console.log("🌱 Demo match seeded (match-001)");
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Closing server...");
  httpServer.close(() => process.exit(0));
});
