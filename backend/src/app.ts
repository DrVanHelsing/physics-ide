import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { Db } from "./db/types.js";
import { createDevMailer, type Mailer } from "./email/mailer.js";
import { withPreferences } from "./email/withPreferences.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { classRoutes } from "./routes/classes.js";
import { memberRoutes } from "./routes/members.js";
import { inviteRoutes } from "./routes/invites.js";
import { projectRoutes } from "./routes/projects.js";
import { assignmentRoutes } from "./routes/assignments.js";
import { groupRoutes } from "./routes/groups.js";
import { guideRoutes } from "./routes/guides.js";
import { tickRoutes } from "./routes/tick.js";
import { shareRoutes } from "./routes/shares.js";
import { notificationRoutes } from "./routes/notifications.js";

export interface AppDeps {
  db: Db;
  mailer?: Mailer;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    mailer: Mailer;
  }
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.decorate("db", deps.db);
  app.decorate("mailer", deps.mailer ?? withPreferences(deps.db, createDevMailer(deps.db)));

  app.register(cookie);
  app.register(rateLimit, { global: false });

  // NOTE: routes added directly on this root instance register BEFORE the
  // rate-limit plugin boots, so `config.rateLimit` on them is silently
  // ignored. Any route that needs a rate limit must live in a plugin
  // registered below (like authRoutes).
  app.get("/api/health", async () => ({ ok: true, service: "physics-ide-api" }));

  app.register(authRoutes);
  app.register(adminRoutes);
  app.register(classRoutes);
  app.register(memberRoutes);
  app.register(inviteRoutes);
  app.register(projectRoutes);
  app.register(assignmentRoutes);
  app.register(groupRoutes);
  app.register(guideRoutes);
  app.register(shareRoutes);
  app.register(notificationRoutes);
  app.register(tickRoutes);

  return app;
}
