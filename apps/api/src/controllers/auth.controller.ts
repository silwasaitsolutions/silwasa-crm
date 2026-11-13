import type { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { ok } from "../utils/api-response";
import { AppError } from "../utils/app-error";
import { COOKIE, clearAuthCookies, setAuthCookies } from "../utils/cookies";
import { requestMeta } from "../utils/request-meta";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "../validators/auth.validators";

const refreshCookie = (req: Request): string | undefined => {
  const v = req.cookies?.[COOKIE.refresh];
  return typeof v === "string" ? v : undefined;
};

export const authController = {
  async login(req: Request, res: Response) {
    const { email, password } = loginSchema.parse(req.body);
    const { user, tokens } = await authService.login(email, password, requestMeta(req));
    setAuthCookies(res, tokens);
    ok(res, { user });
  },

  async refresh(req: Request, res: Response) {
    const token = refreshCookie(req);
    if (!token) throw AppError.unauthorized();
    try {
      const { user, tokens } = await authService.refresh(token);
      setAuthCookies(res, tokens);
      ok(res, { user });
    } catch (err) {
      clearAuthCookies(res);
      throw err;
    }
  },

  async logout(req: Request, res: Response) {
    await authService.logout(
      { sessionId: req.auth?.sessionId, userId: req.auth?.user.id, refreshToken: refreshCookie(req) },
      requestMeta(req),
    );
    clearAuthCookies(res);
    ok(res, { loggedOut: true });
  },

  async logoutAll(req: Request, res: Response) {
    await authService.logoutAll(req.auth!.user.id, requestMeta(req));
    clearAuthCookies(res);
    ok(res, { loggedOut: true });
  },

  me(req: Request, res: Response) {
    ok(res, { user: req.auth!.user });
  },

  async forgotPassword(req: Request, res: Response) {
    const { email } = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(email, requestMeta(req));
    // Identical response whether or not the account exists.
    ok(res, { message: "If an account exists for that email, a reset link has been sent." }, undefined, 202);
  },

  async resetPassword(req: Request, res: Response) {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(token, password, requestMeta(req));
    clearAuthCookies(res);
    ok(res, { message: "Password updated. Please sign in." });
  },

  async changePassword(req: Request, res: Response) {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await authService.changePassword(
      req.auth!.user.id,
      req.auth!.sessionId,
      currentPassword,
      newPassword,
      requestMeta(req),
    );
    ok(res, { message: "Password changed. Other sessions were signed out." });
  },
};

