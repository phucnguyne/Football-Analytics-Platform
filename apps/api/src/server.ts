import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { liveScoresRoutes } from "./routes/live-scores.js";
import { prisma } from "./lib/prisma.js";
import { env } from "./lib/env.js";

async function buildServer() {
  const app = Fastify({
    logger: {
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: [env.WEB_APP_URL],
    credentials: true,
  });

  // Mount routes dưới prefix /api để khớp với reverse proxy / Next.js rewrites nếu có
  await app.register(healthRoutes);
  await app.register(liveScoresRoutes, { prefix: "/api" });

  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    reply.status(error.statusCode ?? 500).send({
      error: error.message ?? "Internal Server Error",
    });
  });

  return app;
}

async function start() {
  const app = await buildServer();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`🚀 API server đang chạy tại http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
