import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import type { UserRecord } from "../types/auth";

const include = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} satisfies Prisma.UserInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof include }>;

function toRecord(row: UserRow): UserRecord {
  const roleKeys = row.roles.map((r) => r.role.key);
  const permissions = [
    ...new Set(row.roles.flatMap((r) => r.role.permissions.map((rp) => rp.permission.key))),
  ];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isActive: row.isActive,
    roleKeys,
    permissions,
    passwordHash: row.passwordHash,
    failedLoginAttempts: row.failedLoginAttempts,
    lockedUntil: row.lockedUntil,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
  };
}

const normalise = (email: string) => email.trim().toLowerCase();

async function roleIdsForKeys(tx: Prisma.TransactionClient, keys: string[]): Promise<string[]> {
  const roles = await tx.role.findMany({ where: { key: { in: keys } }, select: { id: true } });
  return roles.map((r) => r.id);
}

export const userRepository = {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await prisma.user.findFirst({
      where: { email: normalise(email), deletedAt: null },
      include,
    });
    return row ? toRecord(row) : null;
  },

  async findById(id: string): Promise<UserRecord | null> {
    const row = await prisma.user.findFirst({ where: { id, deletedAt: null }, include });
    return row ? toRecord(row) : null;
  },

  async list(opts: { page: number; pageSize: number; search?: string }) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(opts.search
        ? {
            OR: [
              { email: { contains: opts.search, mode: "insensitive" } },
              { name: { contains: opts.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      prisma.user.count({ where }),
    ]);
    return { items: rows.map(toRecord), total };
  },

  async create(data: { email: string; name: string; passwordHash: string; roleKeys: string[] }) {
    return prisma.$transaction(async (tx) => {
      const roleIds = await roleIdsForKeys(tx, data.roleKeys);
      const row = await tx.user.create({
        data: {
          email: normalise(data.email),
          name: data.name,
          passwordHash: data.passwordHash,
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
        include,
      });
      return toRecord(row);
    });
  },

  async update(id: string, data: { name?: string; isActive?: boolean; roleKeys?: string[] }) {
    return prisma.$transaction(async (tx) => {
      if (data.roleKeys) {
        const roleIds = await roleIdsForKeys(tx, data.roleKeys);
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })) });
      }
      const row = await tx.user.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
        include,
      });
      return toRecord(row);
    });
  },

  /** Soft delete. The email is rewritten so the address can be reused later. */
  async softDelete(id: string) {
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, email: `deleted+${id}@invalid.local` },
    });
  },

  async countActiveSuperAdmins(excludeUserId?: string): Promise<number> {
    return prisma.user.count({
      where: {
        deletedAt: null,
        isActive: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        roles: { some: { role: { key: "SUPER_ADMIN" } } },
      },
    });
  },

  async registerFailedLogin(id: string, attempts: number, lockedUntil: Date | null) {
    await prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: attempts, lockedUntil },
    });
  },

  async registerSuccessfulLogin(id: string) {
    await prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  },

  async setPassword(id: string, passwordHash: string) {
    await prisma.user.update({
      where: { id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
  },
};
