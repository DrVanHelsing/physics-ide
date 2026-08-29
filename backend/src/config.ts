import "dotenv/config";
import { z } from "zod";

const EnvSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z
      .string()
      .url()
      .default("postgres://postgres:physics@localhost:5433/physics_ide"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_BASE_URL: z.string().url().default("http://127.0.0.1:3000"),
    /** Shared secret for POST /api/tick (task 24, design D§6's one scheduler).
     *  A fixed dev default is fine outside production — nothing else guards
     *  that endpoint there. Production has no safe default: the whole point
     *  of the header is that only Cloud Scheduler knows it. */
    TICK_SECRET: z.string().min(1).optional(),
    /** Which Mailer implementation backs app.mailer. Defaults to the
     *  pretend inbox so every existing dev/test run stays byte-identical;
     *  Task 3 adds the "brevo" driver itself, this key only selects it. */
    MAIL_DRIVER: z.enum(["dev", "brevo"]).default("dev"),
    /** From address for outbound mail — required only when MAIL_DRIVER=brevo;
     *  the dev driver never reads it. */
    MAIL_FROM: z.string().min(1).optional(),
    /** Brevo API key — required only when MAIL_DRIVER=brevo. */
    BREVO_API_KEY: z.string().min(1).optional(),
    /** Shared secret the Brevo delivery webhook must present. Required in
     *  production regardless of driver (see the superRefine below) — NOT
     *  tied to MAIL_DRIVER the way MAIL_FROM/BREVO_API_KEY are. */
    MAIL_WEBHOOK_SECRET: z.string().min(1).optional(),
    /** Whether Fastify trusts X-Forwarded-* from the reverse proxy in front
     *  of it (DEPLOY.md's "before the GCP step" box: trustProxy for the
     *  load balancer). z.coerce.boolean() is a trap here — Boolean("false")
     *  is true — so this is an enum mapped by hand below instead. */
    TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV === "production" && !val.TICK_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "TICK_SECRET is required in production.",
        path: ["TICK_SECRET"],
      });
    }
    // A revision deployed to production without MAIL_DRIVER=brevo otherwise
    // boots happily and writes every message — full body, live token —
    // into the pretend inbox.
    if (val.NODE_ENV === "production" && val.MAIL_DRIVER !== "brevo") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MAIL_DRIVER must be "brevo" in production.',
        path: ["MAIL_DRIVER"],
      });
    }
    if (val.MAIL_DRIVER === "brevo" && !val.MAIL_FROM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "MAIL_FROM is required when MAIL_DRIVER=brevo.",
        path: ["MAIL_FROM"],
      });
    }
    if (val.MAIL_DRIVER === "brevo" && !val.BREVO_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "BREVO_API_KEY is required when MAIL_DRIVER=brevo.",
        path: ["BREVO_API_KEY"],
      });
    }
    if (val.NODE_ENV === "production" && !val.MAIL_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "MAIL_WEBHOOK_SECRET is required in production.",
        path: ["MAIL_WEBHOOK_SECRET"],
      });
    }
  });

const env = EnvSchema.parse(process.env);

export const config = {
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  nodeEnv: env.NODE_ENV,
  appBaseUrl: env.APP_BASE_URL,
  tickSecret: env.TICK_SECRET ?? "dev-tick",
  mailDriver: env.MAIL_DRIVER,
  mailFrom: env.MAIL_FROM,
  brevoApiKey: env.BREVO_API_KEY,
  // Non-optional fallback, deliberately: without it this key is `undefined`
  // under the default MAIL_DRIVER=dev, a header-less webhook request yields
  // `undefined !== undefined` -> false, and the webhook door opens to anyone.
  mailWebhookSecret: env.MAIL_WEBHOOK_SECRET ?? "dev-mail-hook",
  trustProxy: env.TRUST_PROXY === "true",
} as const;
