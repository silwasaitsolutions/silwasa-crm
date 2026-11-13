import type { Request } from "express";
import type { RequestMeta } from "../types/auth";

export const requestMeta = (req: Request): RequestMeta => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});
