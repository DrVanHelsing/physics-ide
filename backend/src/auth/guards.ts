import type { FastifyReply, FastifyRequest } from "fastify";
import type { users } from "../db/schema.js";
import { getUserBySessionToken, SESSION_COOKIE } from "./session.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: typeof users.$inferSelect;
  }
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.cookies[SESSION_COOKIE];
  const user = token ? await getUserBySessionToken(req.server.db, token) : null;
  if (!user) {
    await reply.code(401).send({ error: "Not signed in." });
    return;
  }
  req.user = user;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (req.user!.role !== "admin") {
    await reply.code(403).send({ error: "Admin only." });
  }
}
