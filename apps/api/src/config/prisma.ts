import { PrismaClient } from "@prisma/client";
import { getEnv } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: getEnv().isProd ? ["error"] : ["warn", "error"],
  });

if (!getEnv().isProd) globalForPrisma.prisma = prisma;
