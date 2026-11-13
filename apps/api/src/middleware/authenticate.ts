import type { RequestHandler } from "express";
import { authService } from "../services/auth.service";
import { AppError } from "../utils/app-error";
import { COOKIE } from "../utils/cookies";

/** Requires a valid access-token cookie whose session and user are still active in the database. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[COOKIE.access];
    const result = typeof token === "string" ? await authService.authenticate(token) : null;
    if (!result) throw AppError.unauthorized();
    req.auth = { user: result.user, sessionId: result.sessionId };
    next();
  } catch (err) {
    next(err);
  }
};
