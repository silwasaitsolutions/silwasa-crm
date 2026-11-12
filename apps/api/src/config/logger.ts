import pino from "pino";
import { getEnv } from "./env";

const env = getEnv();

export const logger = pino({
  level: env.LOG_LEVEL ?? (env.NODE_ENV === "test" ? "silent" : "info"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.token",
      "*.secret",
    ],
    censor: "[REDACTED]",
  },
  transport: env.isProd ? undefined : { target: "pino-pretty", options: { colorize: true } },
});
