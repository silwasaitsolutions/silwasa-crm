import type { RequestHandler } from "express";
import { getEnv } from "../config/env";
import { AppError } from "../utils/app-error";
import { safeEqual } from "../utils/crypto";
import { COOKIE } from "../utils/cookies";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Unauthenticated entry points: no session cookie exists yet that could be abused.
const TOKEN_EXEMPT = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
]);

/**
 * CSRF defence for cookie-authenticated, state-changing requests:
 *  1. If an Origin header is present it must be in the CORS allowlist.
 *  2. Double-submit token: the x-csrf-token header must equal the readable csrf cookie.
 * Combined with SameSite=Lax cookies and JSON-only bodies.
 */
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.header("origin");
  if (origin && !getEnv().corsOrigins.includes(origin)) {
    return next(AppError.forbidden("Origin not allowed"));
  }

  if (TOKEN_EXEMPT.has(req.baseUrl + req.path)) return next();

  const cookieToken = req.cookies?.[COOKIE.csrf];
  const headerToken = req.header("x-csrf-token");
  if (
    typeof cookieToken !== "string" ||
    typeof headerToken !== "string" ||
    !safeEqual(cookieToken, headerToken)
  ) {
    return next(new AppError(403, "CSRF_INVALID", "Invalid or missing CSRF token"));
  }
  next();
};
