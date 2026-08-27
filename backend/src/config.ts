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
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV === "production" && !val.TICK_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "TICK_SECRET is required in production.",
        path: ["TICK_SECRET"],
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
} as const;
