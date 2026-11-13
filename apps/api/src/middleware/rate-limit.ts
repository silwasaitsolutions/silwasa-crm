import { rateLimit } from "express-rate-limit";
import { getEnv } from "../config/env";

const handler = (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
  res.status(429).json({
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
  });

export const createLimiter = (opts: { windowMs: number; limit: number }) =>
  rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler,
  });

// Tests use a high ceiling so they do not interfere with each other; the limiter itself is tested in isolation.
const scale = () => (getEnv().NODE_ENV === "test" ? 1000 : 1);

export const loginLimiter = () => createLimiter({ windowMs: 15 * 60_000, limit: 10 * scale() });
export const passwordResetLimiter = () => createLimiter({ windowMs: 60 * 60_000, limit: 5 * scale() });
export const authGeneralLimiter = () => createLimiter({ windowMs: 60_000, limit: 60 * scale() });
