import type { RequestHandler } from "express";
import { roleHasAll, type PermissionKey } from "../rbac/catalog";
import { AppError } from "../utils/app-error";

/**
 * Enforces permissions on the server for every protected endpoint. Must run after `authenticate`.
 * All listed permissions are required.
 */
export const requirePermission =
  (...required: PermissionKey[]): RequestHandler =>
  (req, _res, next) => {
    const user = req.auth?.user;
    if (!user) return next(AppError.unauthorized());
    const allowed = roleHasAll(user.roleKeys) || required.every((p) => user.permissions.includes(p));
    next(allowed ? undefined : AppError.forbidden());
  };

/** Passes when the user holds at least one of the listed permissions. Must run after `authenticate`. */
export const requireAnyPermission =
  (...candidates: PermissionKey[]): RequestHandler =>
  (req, _res, next) => {
    const user = req.auth?.user;
    if (!user) return next(AppError.unauthorized());
    const allowed = roleHasAll(user.roleKeys) || candidates.some((p) => user.permissions.includes(p));
    next(allowed ? undefined : AppError.forbidden());
  };
