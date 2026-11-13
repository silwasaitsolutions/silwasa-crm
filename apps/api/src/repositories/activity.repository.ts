import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export interface ActivityInput {
  userId?: string | null;
  action: string;
  module: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

export const activityRepository = {
  /** Most recent entries for the dashboard. Deliberately excludes before/after payloads and IP addresses. */
  async listRecent(limit: number) {
    const rows = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        module: true,
        entityId: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      module: r.module,
      entityId: r.entityId,
      createdAt: r.createdAt,
      actor: r.user ? { name: r.user.name, email: r.user.email } : null,
    }));
  },

  async create(input: ActivityInput) {
    await prisma.activityLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        module: input.module,
        entityId: input.entityId ?? null,
        before: input.before,
        after: input.after,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
      },
    });
  },
};
