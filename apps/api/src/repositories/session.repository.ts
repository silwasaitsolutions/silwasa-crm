import { prisma } from "../config/prisma";
import type { SessionRecord } from "../types/auth";

const select = { id: true, userId: true, refreshTokenHash: true, expiresAt: true, revokedAt: true } as const;

export const sessionRepository = {
  async create(data: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<SessionRecord> {
    return prisma.session.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent?.slice(0, 255) ?? null,
      },
      select,
    });
  },

  findById: (id: string): Promise<SessionRecord | null> =>
    prisma.session.findUnique({ where: { id }, select }),

  findByRefreshHash: (refreshTokenHash: string): Promise<SessionRecord | null> =>
    prisma.session.findUnique({ where: { refreshTokenHash }, select }),

  /** Compare-and-swap: only succeeds if the presented token is still the current one. */
  async rotate(id: string, oldHash: string, newHash: string, expiresAt: Date): Promise<boolean> {
    const res = await prisma.session.updateMany({
      where: { id, refreshTokenHash: oldHash, revokedAt: null },
      data: { refreshTokenHash: newHash, expiresAt, lastUsedAt: new Date() },
    });
    return res.count === 1;
  },

  async revoke(id: string) {
    await prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  },

  async revokeAllForUser(userId: string, exceptSessionId?: string) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  },
};
