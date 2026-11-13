/**
 * Idempotent seed: permissions, system roles and the first Super Admin.
 *
 *   SEED_ADMIN_EMAIL=you@company.com SEED_ADMIN_NAME="Your Name" SEED_ADMIN_PASSWORD='long passphrase' pnpm db:seed
 *
 * - Permissions are always upserted from src/rbac/catalog.ts.
 * - SUPER_ADMIN is always granted every permission.
 * - Other system roles receive their default permissions only when first created, so changes made
 *   later in the admin UI are never overwritten by re-running the seed.
 * - The Super Admin is only created when no active Super Admin exists. No password is hard-coded;
 *   it comes from the environment and is never logged.
 */
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { passwordService } from "../src/services/password.service";
import { ALL_PERMISSIONS, ROLE_DEFINITIONS, SYSTEM_ROLES } from "../src/rbac/catalog";

dotenv.config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

const prisma = new PrismaClient();

async function seedPermissions() {
  for (const key of ALL_PERMISSIONS) {
    const module = key.split(":")[0]!;
    await prisma.permission.upsert({ where: { key }, update: { module }, create: { key, module } });
  }
  console.log(`Permissions: ${ALL_PERMISSIONS.length} ensured`);
}

async function seedRoles() {
  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const idByKey = new Map(permissions.map((p) => [p.key, p.id]));

  for (const key of SYSTEM_ROLES) {
    const def = ROLE_DEFINITIONS[key];
    const existing = await prisma.role.findUnique({ where: { key } });
    const role =
      existing ??
      (await prisma.role.create({
        data: { key, name: def.name, description: def.description, isSystem: true },
      }));

    if (!existing || key === "SUPER_ADMIN") {
      const ids = def.permissions.map((p) => idByKey.get(p)!).filter(Boolean);
      await prisma.rolePermission.createMany({
        data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
    console.log(`Role ${key}: ${existing ? "exists" : "created with default permissions"}`);
  }
}

async function bootstrapSuperAdmin() {
  const existing = await prisma.user.count({
    where: { deletedAt: null, isActive: true, roles: { some: { role: { key: "SUPER_ADMIN" } } } },
  });
  if (existing > 0) {
    console.log("Super Admin: already present, nothing to do");
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Super Admin";

  if (!email || !password) {
    console.warn(
      "Super Admin: NOT created. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (12+ characters) and run the seed again.",
    );
    return;
  }
  if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters");

  const role = await prisma.role.findUniqueOrThrow({ where: { key: "SUPER_ADMIN" } });
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await passwordService.hash(password),
      roles: { create: [{ roleId: role.id }] },
    },
  });
  await prisma.activityLog.create({
    data: { userId: user.id, action: "user.bootstrap_super_admin", module: "users", entityId: user.id },
  });
  console.log(`Super Admin: created ${email}. Remove SEED_ADMIN_PASSWORD from your environment now.`);
}

async function main() {
  await seedPermissions();
  await seedRoles();
  await bootstrapSuperAdmin();
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
