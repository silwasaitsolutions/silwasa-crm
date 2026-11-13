import { prisma } from "../config/prisma";

export const resetTokenRepository = {
  async create(userId: string, tokenHash: string, expiresAt: Date) {
    // Only one outstanding token per user.
    await prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  },

  findValidByHash: (tokenHash: string) =>
    prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true },
    }),

  /**
   * Atomically: consume the token, set the new password, clear lockout and revoke every session.
   * Returns false if the token was already consumed by a concurrent request.
   */
  async complete(tokenId: string, userId: string, passwordHash: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const used = await tx.passwordResetToken.updateMany({
        where: { id: tokenId, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (used.count !== 1) return false;
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return true;
    });
  },
};
