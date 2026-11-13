import type { CookieOptions, Response } from "express";
import { getEnv } from "../config/env";

export const COOKIE = { access: "sw_access", refresh: "sw_refresh", csrf: "sw_csrf" } as const;

const base = (): CookieOptions => {
  const env = getEnv();
  return { secure: env.isProd, sameSite: "lax", domain: env.COOKIE_DOMAIN || undefined, path: "/" };
};

export function setAuthCookies(
  res: Response,
  t: { access: string; refresh: string; csrf: string; refreshExpires: Date },
) {
  const env = getEnv();
  res.cookie(COOKIE.access, t.access, {
    ...base(),
    httpOnly: true,
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60_000,
  });
  // The refresh cookie is only ever sent to the auth endpoints.
  res.cookie(COOKIE.refresh, t.refresh, {
    ...base(),
    httpOnly: true,
    path: "/api/v1/auth",
    expires: t.refreshExpires,
  });
  // Readable by the admin UI so it can echo the value in the x-csrf-token header (double-submit).
  res.cookie(COOKIE.csrf, t.csrf, { ...base(), httpOnly: false, expires: t.refreshExpires });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(COOKIE.access, { ...base(), httpOnly: true });
  res.clearCookie(COOKIE.refresh, { ...base(), httpOnly: true, path: "/api/v1/auth" });
  res.clearCookie(COOKIE.csrf, { ...base(), httpOnly: false });
}
