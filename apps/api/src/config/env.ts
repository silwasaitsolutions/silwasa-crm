import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Load the monorepo-root .env first, then an optional apps/api/.env override.
// Tests are fully isolated: they never read a developer's real .env (e.g. Supabase credentials).
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  dotenv.config({ path: path.resolve(__dirname, "../../../../.env"), quiet: true });
  dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true, quiet: true });
}

const hexBytes = (bytes: number) => new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  ENCRYPTION_KEY: z.string().regex(hexBytes(32), "ENCRYPTION_KEY must be 64 hex characters (32 bytes)"),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  COOKIE_DOMAIN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
});

export type Env = z.infer<typeof schema> & { corsOrigins: string[]; isProd: boolean };

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  const data = result.data;
  return {
    ...data,
    corsOrigins: data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    isProd: data.NODE_ENV === "production",
  };
}

let cached: Env | undefined;
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
