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
