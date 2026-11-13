import { getEnv } from "../config/env";
import { mailer } from "../integrations/email/mailer";
import { resetTokenRepository } from "../repositories/reset-token.repository";
import { sessionRepository } from "../repositories/session.repository";
import { userRepository } from "../repositories/user.repository";
import type { AuthUser, RequestMeta, UserRecord } from "../types/auth";
import { AppError } from "../utils/app-error";
import { randomToken, sha256 } from "../utils/crypto";
import { activityService } from "./activity.service";
import { passwordService, verifyAgainstDummy } from "./password.service";
import { tokenService } from "./token.service";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
const RESET_TTL_MINUTES = 60;

const INVALID_CREDENTIALS = () =>
  new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");

export interface IssuedTokens {
  access: string;
  refresh: string;
  csrf: string;
  refreshExpires: Date;
}

export const toAuthUser = (u: UserRecord | AuthUser): AuthUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  isActive: u.isActive,
  roleKeys: u.roleKeys,
  permissions: u.permissions,
});

const refreshExpiry = () => new Date(Date.now() + getEnv().REFRESH_TOKEN_TTL_DAYS * 86_400_000);

export const authService = {
  async login(email: string, password: string, meta: RequestMeta) {
    const user = await userRepository.findByEmail(email);

    if (!user) {
      await verifyAgainstDummy(password);
      await activityService.log({ action: "auth.login_failed", module: "auth", after: { email }, ...meta });
      throw INVALID_CREDENTIALS();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await activityService.log({ userId: user.id, action: "auth.login_blocked", module: "auth", ...meta });
      throw new AppError(429, "ACCOUNT_LOCKED", "Too many failed attempts. Please try again later.");
    }

    const valid = user.isActive
      ? await passwordService.verify(user.passwordHash, password)
      : (await verifyAgainstDummy(password), false);

    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const lock = attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null;
      await userRepository.registerFailedLogin(user.id, lock ? 0 : attempts, lock);
      await activityService.log({
        userId: user.id,
        action: lock ? "auth.account_locked" : "auth.login_failed",
        module: "auth",
        ...meta,
      });
      throw INVALID_CREDENTIALS();
    }

    await userRepository.registerSuccessfulLogin(user.id);
    const tokens = await authService.startSession(user.id, meta);
    await activityService.log({ userId: user.id, action: "auth.login", module: "auth", ...meta });
    return { user: toAuthUser(user), tokens };
  },

  async startSession(userId: string, meta: RequestMeta): Promise<IssuedTokens> {
    const refresh = randomToken();
    const refreshExpires = refreshExpiry();
    const session = await sessionRepository.create({
      userId,
      refreshTokenHash: sha256(refresh),
      expiresAt: refreshExpires,
      ...meta,
    });
    return {
      access: await tokenService.signAccessToken(userId, session.id),
      refresh,
      csrf: randomToken(24),
      refreshExpires,
    };
  },

  /** Rotates the refresh token. A token that is not the current one is rejected. */
  async refresh(refreshToken: string) {
    const oldHash = sha256(refreshToken);
    const session = await sessionRepository.findByRefreshHash(oldHash);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw AppError.unauthorized();

    const user = await userRepository.findById(session.userId);
    if (!user || !user.isActive) {
      await sessionRepository.revoke(session.id);
      throw AppError.unauthorized();
    }

    const refresh = randomToken();
    const refreshExpires = refreshExpiry();
    const rotated = await sessionRepository.rotate(session.id, oldHash, sha256(refresh), refreshExpires);
    if (!rotated) throw AppError.unauthorized();

    return {
      user: toAuthUser(user),
      tokens: {
        access: await tokenService.signAccessToken(user.id, session.id),
        refresh,
        csrf: randomToken(24),
        refreshExpires,
      } satisfies IssuedTokens,
    };
  },

  /** Resolves an access token to the current user, re-checking session and account state in the DB. */
  async authenticate(accessToken: string): Promise<{ user: AuthUser; sessionId: string } | null> {
    const claims = await tokenService.verifyAccessToken(accessToken);
    if (!claims) return null;
    const session = await sessionRepository.findById(claims.sessionId);
    if (!session || session.userId !== claims.userId || session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }
    const user = await userRepository.findById(claims.userId);
    if (!user || !user.isActive) return null;
    return { user: toAuthUser(user), sessionId: session.id };
  },

  async logout(opts: { sessionId?: string; refreshToken?: string; userId?: string }, meta: RequestMeta) {
    let sessionId = opts.sessionId;
    let userId = opts.userId;
    if (!sessionId && opts.refreshToken) {
      const s = await sessionRepository.findByRefreshHash(sha256(opts.refreshToken));
      sessionId = s?.id;
      userId = s?.userId;
    }
    if (sessionId) {
      await sessionRepository.revoke(sessionId);
      await activityService.log({ userId, action: "auth.logout", module: "auth", ...meta });
    }
  },

  async logoutAll(userId: string, meta: RequestMeta) {
    await sessionRepository.revokeAllForUser(userId);
    await activityService.log({ userId, action: "auth.logout_all", module: "auth", ...meta });
  },

  /** Always resolves without revealing whether the address exists. */
  async forgotPassword(email: string, meta: RequestMeta) {
    const user = await userRepository.findByEmail(email);
    if (!user || !user.isActive) return;
    const token = randomToken();
    await resetTokenRepository.create(user.id, sha256(token), new Date(Date.now() + RESET_TTL_MINUTES * 60_000));
    const url = `${getEnv().FRONTEND_URL}/admin/reset-password?token=${token}`;
    await mailer.sendPasswordReset({ email: user.email, name: user.name }, url);
    await activityService.log({ userId: user.id, action: "auth.password_reset_requested", module: "auth", ...meta });
  },

  async resetPassword(token: string, newPassword: string, meta: RequestMeta) {
    const record = await resetTokenRepository.findValidByHash(sha256(token));
    if (!record) throw AppError.badRequest("This reset link is invalid or has expired");
    const user = await userRepository.findById(record.userId);
    if (!user || !user.isActive) throw AppError.badRequest("This reset link is invalid or has expired");
    assertPasswordAllowed(newPassword, user.email);

    const done = await resetTokenRepository.complete(record.id, user.id, await passwordService.hash(newPassword));
    if (!done) throw AppError.badRequest("This reset link is invalid or has expired");
    await activityService.log({ userId: user.id, action: "auth.password_reset", module: "auth", ...meta });
  },

  async changePassword(
    userId: string,
    sessionId: string,
    current: string,
    next: string,
    meta: RequestMeta,
  ) {
    const user = await userRepository.findById(userId);
    if (!user || !(await passwordService.verify(user.passwordHash, current))) {
      throw new AppError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
    }
    assertPasswordAllowed(next, user.email);
    await userRepository.setPassword(userId, await passwordService.hash(next));
    // Keep this device signed in; sign out every other session.
    await sessionRepository.revokeAllForUser(userId, sessionId);
    await activityService.log({ userId, action: "auth.password_changed", module: "auth", ...meta });
  },
};

/** Length-first policy (NIST 800-63B) plus a guard against using the account email. */
export function assertPasswordAllowed(password: string, email: string) {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (password.toLowerCase() === email.toLowerCase() || (local.length >= 4 && password.toLowerCase().includes(local))) {
    throw AppError.badRequest("Password must not contain your email address");
  }
}
