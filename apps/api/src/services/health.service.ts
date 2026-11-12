import { prisma } from "../config/prisma";

const startedAt = Date.now();

export const healthService = {
  liveness() {
    return {
      status: "ok" as const,
      service: "silwasa-api",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  },

  async readiness(check: () => Promise<unknown> = () => prisma.$queryRaw`SELECT 1`) {
    try {
      await check();
      return { status: "ok" as const, database: "up" as const, timestamp: new Date().toISOString() };
    } catch {
      return { status: "degraded" as const, database: "down" as const, timestamp: new Date().toISOString() };
    }
  },
};
