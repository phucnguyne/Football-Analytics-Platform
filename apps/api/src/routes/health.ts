import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    return reply.send({ status: "ok", service: "api", timestamp: new Date().toISOString() });
  });
}
