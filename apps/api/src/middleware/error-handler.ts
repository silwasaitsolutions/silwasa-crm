import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { getEnv } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../utils/app-error";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` },
    meta: { requestId: req.id },
  });
};

// Express identifies error middleware by its 4-argument signature, so `_next` must stay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      meta: { requestId: req.id },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
      meta: { requestId: req.id },
    });
    return;
  }

  logger.error({ err, requestId: req.id }, "Unhandled error");
  res.status(500).json({
    success: false,
    // Never leak internals in production.
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
      ...(getEnv().isProd ? {} : { details: err instanceof Error ? err.message : String(err) }),
    },
    meta: { requestId: req.id },
  });
};
