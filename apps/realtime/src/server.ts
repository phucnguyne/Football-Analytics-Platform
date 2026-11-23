// ─── server.ts ────────────────────────────────────────────────────────────────
// Entry point của realtime server. Chỉ làm 1 việc: khởi động HTTP + Socket.io.
// Business logic KHÔNG nằm ở đây.
import "dotenv/config";
import express from "express";
import { createServer } from "http";

import { env } from "./config/env";
import type { RedisConnections } from "./config/redis";
import {
  closeRedisConnections,
  connectRedis,
  getRedisClient,
} from "./config/redis";
import { createSocketServer } from "./config/socket";
import { loggerMiddleware } from "./middleware/logger";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { registerSockets } from "./socket";
import { createInternalRouter } from "./routes/internal";
import { seedDemoMatch } from "./service/match.service";

// ── HTTP app (chỉ dùng để tạo httpServer, không cần route) ──────────────────
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.get("/health", (_req, res) => {
  const redisClient = getRedisClient();
  const redisReady = !redisClient || redisClient.isReady;
  res.status(redisReady ? 200 : 503).json({
    status: redisReady ? "ok" : "degraded",
    redis: !redisClient ? "disabled" : redisReady ? "ready" : "unavailable",
    uptime: process.uptime(),
  });
});

const httpServer = createServer(app);
let activeRedisConnections: RedisConnections | null = null;

async function startServer(): Promise<void> {
  const redisConnections = await connectRedis();
  activeRedisConnections = redisConnections;
  const io = createSocketServer(httpServer, redisConnections);

  // Route HTTP nội bộ — chỉ service `api` gọi sang để trigger broadcast
  app.use("/internal", createInternalRouter(io));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (error as { status?: number })?.status;
    res.status(status === 400 || status === 413 ? status : 500).json({ error: "Request failed" });
  });

  // Public sockets can subscribe to the live feed.
  io.use(loggerMiddleware);
  io.use(rateLimitMiddleware({ maxEvents: 30, windowMs: 10_000 }));

  // Đăng ký tất cả event handler
  registerSockets(io);

  if (env.isDev) {
    await seedDemoMatch();
    console.log("🌱 Demo match seeded (match-001)");
  }

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(env.port, resolve);
  });

  console.log(`🚀 Realtime server running on http://localhost:${env.port}`);
  console.log(`   ENV: ${env.nodeEnv}`);
  console.log(`   CORS origin: ${env.webUrl}`);
  console.log(
    `   Redis: ${redisConnections ? "enabled" : "disabled (in-memory dev mode)"}`,
  );

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received. Closing server...`);
    io.close(() => {
      if (!redisConnections) return;
      void closeRedisConnections(redisConnections)
        .catch((error: unknown) => {
          console.error("[redis] failed to close connections:", error);
          process.exitCode = 1;
        })
        .finally(() => {
          activeRedisConnections = null;
        });
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

void startServer().catch(async (error: unknown) => {
  console.error("Failed to start realtime server:", error);
  if (activeRedisConnections) {
    try {
      await closeRedisConnections(activeRedisConnections);
    } catch (closeError: unknown) {
      console.error(
        "[redis] failed to close connections after startup error:",
        closeError,
      );
    }
    activeRedisConnections = null;
  }
  process.exitCode = 1;
});
