import { prisma } from "../config/prisma";

export const roleRepository = {
  async listWithPermissions() {
    const rows = await prisma.role.findMany({
      orderBy: { key: "asc" },
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((rp) => rp.permission.key).sort(),
    }));
  },

  listPermissions: () =>
    prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { key: "asc" }],
      select: { key: true, module: true, description: true },
    }),

  findById: (id: string) => prisma.role.findUnique({ where: { id }, select: { id: true, key: true } }),

  async setPermissions(roleId: string, keys: string[]) {
    await prisma.$transaction(async (tx) => {
      const perms = await tx.permission.findMany({ where: { key: { in: keys } }, select: { id: true } });
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: perms.map((p) => ({ roleId, permissionId: p.id })),
      });
    });
  },

  async existingKeys(keys: string[]): Promise<string[]> {
    const rows = await prisma.role.findMany({ where: { key: { in: keys } }, select: { key: true } });
    return rows.map((r) => r.key);
  },
};
