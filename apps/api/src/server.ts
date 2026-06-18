import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";
import { liveScoresRoutes } from "./routes/live-scores.js";
import { prisma } from "./lib/prisma.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const WEB_APP_URL = process.env.WEB_APP_URL ?? "http://localhost:3000";

async function buildServer() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: [WEB_APP_URL],
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
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`🚀 API server đang chạy tại http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
