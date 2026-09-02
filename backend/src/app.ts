import path from "node:path";
import fs from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
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
 *  join-code throttle (members.ts) and the six inherited auth-route
 *  limiters (auth.ts x5 — signup, signin, forgot, reset, change-password —
 *  plus mailEvents.ts x1) alike. */
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

  /* ── Single-origin static serving (Task 10b / DEPLOY-GCP.md option 1) ──
     Firebase Hosting's rewrite-to-Cloud-Run does not support africa-south1,
     so the container carries its own static story: with STATIC_DIR set (the
     image bakes it; nothing else does), this API serves the built SPA from
     the same origin — which is what `credentials: "same-origin"`,
     `SameSite=Lax` and the absent CORS plugin were always counting on. The
     header rules mirror vercel.json/firebase.json: hashed /assets immutable
     for a year; the unhashed runtime-fetched /vendor and /blockly-media a
     day (the Locked repeat-Run-offline term, product-contract.md); the
     COOP/COEP pair on everything. Unknown non-API paths fall back to the
     SPA shell; the /api namespace keeps its own 404s. Without STATIC_DIR
     this whole block is inert and the app is byte-identical to before. */
  const staticRoot = config.staticDir;
  if (staticRoot && fs.existsSync(path.join(staticRoot, "index.html"))) {
    app.register(fastifyStatic, { root: staticRoot, index: "index.html" });
    /* One hook, not setHeaders: it also covers the SPA-fallback response
       below, which setHeaders never sees. API responses are left alone —
       these are the HOSTING layer's headers, exactly what firebase.json/
       vercel.json apply to their files. */
    app.addHook("onSend", async (req, reply) => {
      const url = req.url;
      if (url.startsWith("/api")) return;
      if (url.startsWith("/assets/")) {
        reply.header("Cache-Control", "public, max-age=31536000, immutable");
      } else if (url.startsWith("/vendor/") || url.startsWith("/blockly-media/")) {
        reply.header("Cache-Control", "public, max-age=86400");
      }
      reply.header("Cross-Origin-Opener-Policy", "same-origin");
      reply.header("Cross-Origin-Embedder-Policy", "unsafe-none");
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "Not found." });
    });
  } else if (staticRoot) {
    // A configured directory with no index.html is a broken deploy, not a
    // quiet API-only fallback — say so at boot, loudly.
    app.log.error({ staticRoot }, "STATIC_DIR is set but holds no index.html — serving API only");
  }

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
