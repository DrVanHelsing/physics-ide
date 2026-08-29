import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { Db } from "./db/types.js";
import type { Mailer } from "./email/mailer.js";
import { withPreferences } from "./email/withPreferences.js";
import { neverThrow, suppressErased, selectMailDriver } from "./email/guards.js";
import { config } from "./config.js";
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
import { mailEventsRoutes } from "./routes/mailEvents.js";
import { shareRoutes } from "./routes/shares.js";
import { notificationRoutes } from "./routes/notifications.js";

export interface AppDeps {
  db: Db;
  mailer?: Mailer;
}

/** DEPLOY.md box 8 — every 429 in this app, from any `config: { rateLimit
 *  }` route registered below, gets this house sentence instead of
 *  @fastify/rate-limit's own default body ({ error: "Too Many Requests",
 *  message: `Rate limit exceeded, retry in ${after}` } — its own
 *  `defaultErrorResponse`). That default reaches the client verbatim: the
 *  frontend's api client surfaces `data.error` straight through, and this
 *  project holds a high bar on product copy. One `errorResponseBuilder` on
 *  the plugin registration below fixes every limiter that shares it — the
 *  join-code throttle (members.ts) and the five inherited auth-route
 *  limiters (auth.ts x4, mailEvents.ts x1) alike. */
export const RATE_LIMIT_MESSAGE = "You're doing that too fast. Wait a moment and try again.";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    mailer: Mailer;
  }
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test", trustProxy: config.trustProxy });

  app.decorate("db", deps.db);
  // The injectable dep moves INSIDE the wrappers (not `deps.mailer ?? <wrapped default>`
  // as before) so a test can inject a fake driver and still exercise the real guards.
  // Order is fixed and load-bearing — see guards.ts's neverThrow doc comment for why
  // never-throw must be outermost.
  app.decorate(
    "mailer",
    neverThrow(
      app.log,
      withPreferences(deps.db, suppressErased(deps.mailer ?? selectMailDriver(config, deps.db))),
    ),
  );

  app.register(cookie);
  app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_req, context) => ({
      statusCode: context.statusCode,
      error: RATE_LIMIT_MESSAGE,
    }),
  });

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
  app.register(mailEventsRoutes);

  return app;
}
