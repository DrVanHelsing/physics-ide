import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://postgres:physics@localhost:5433/physics_ide"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const env = EnvSchema.parse(process.env);

export const config = {
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  nodeEnv: env.NODE_ENV,
} as const;
