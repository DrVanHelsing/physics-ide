import Fastify, { type FastifyInstance } from "fastify";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.get("/api/health", async () => ({ ok: true, service: "physics-ide-api" }));

  return app;
}
