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

  findById: (id: string) =>
    prisma.role.findUnique({
      where: { id },
      select: { id: true, key: true, name: true, description: true, isSystem: true },
    }),

  countUsers: (roleId: string) => prisma.userRole.count({ where: { roleId, user: { deletedAt: null } } }),

  async create(data: { key: string; name: string; description?: string; permissionKeys: string[] }) {
    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: { key: data.key, name: data.name, description: data.description ?? null, isSystem: false },
        select: { id: true, key: true },
      });
      const perms = await tx.permission.findMany({
        where: { key: { in: data.permissionKeys } },
        select: { id: true },
      });
      await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
      return role;
    });
  },

  update: (id: string, data: { name?: string; description?: string | null }) =>
    prisma.role.update({ where: { id }, data, select: { id: true } }),

  remove: (id: string) => prisma.role.delete({ where: { id } }),

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
