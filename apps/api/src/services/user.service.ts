import { getEnv } from "../config/env";
import { mailer } from "../integrations/email/mailer";
import { ALL_PERMISSIONS } from "../rbac/catalog";
import { resetTokenRepository } from "../repositories/reset-token.repository";
import { roleRepository } from "../repositories/role.repository";
import { sessionRepository } from "../repositories/session.repository";
import { userRepository } from "../repositories/user.repository";
import type { RequestMeta, UserRecord } from "../types/auth";
import { AppError } from "../utils/app-error";
import { randomToken, sha256 } from "../utils/crypto";
import { activityService } from "./activity.service";
import { toAuthUser } from "./auth.service";
import { passwordService } from "./password.service";

const INVITE_TTL_HOURS = 72;

const publicUser = (u: UserRecord) => ({
  ...toAuthUser(u),
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
  deletedAt: u.deletedAt,
});

async function assertRolesExist(keys: string[]) {
  const existing = await roleRepository.existingKeys(keys);
  const missing = keys.filter((k) => !existing.includes(k));
  if (missing.length) throw AppError.badRequest(`Unknown role(s): ${missing.join(", ")}`);
}

async function assertNotLastSuperAdmin(target: UserRecord) {
  if (!target.roleKeys.includes("SUPER_ADMIN")) return;
  if ((await userRepository.countActiveSuperAdmins(target.id)) === 0) {
    throw new AppError(409, "LAST_SUPER_ADMIN", "At least one active Super Admin must remain");
  }
}

export const userService = {
  async list(opts: {
    page: number;
    pageSize: number;
    search?: string;
    status?: "active" | "inactive" | "deleted";
    roleKey?: string;
  }) {
    const { items, total } = await userRepository.list(opts);
    return {
      items: items.map(publicUser),
      pagination: {
        page: opts.page,
        pageSize: opts.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
      },
    };
  },

  async get(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw AppError.notFound("User not found");
    return publicUser(user);
  },

  /** Creates the account with an unusable password and issues a one-time invitation link. */
  async create(
    actorId: string,
    input: { email: string; name: string; roleKeys: string[] },
    meta: RequestMeta,
  ) {
    const existing = await userRepository.findByEmailIncludingDeleted(input.email);
    if (existing) {
      throw existing.deletedAt
        ? new AppError(409, "EMAIL_DELETED", "This email belongs to a deleted user. Restore that user instead.")
        : new AppError(409, "EMAIL_IN_USE", "A user with this email already exists");
    }
    await assertRolesExist(input.roleKeys);

    const user = await userRepository.create({
      ...input,
      passwordHash: await passwordService.hash(randomToken(32)),
    });

    const token = randomToken();
    await resetTokenRepository.create(user.id, sha256(token), new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000));
    const inviteUrl = `${getEnv().FRONTEND_URL}/admin/reset-password?token=${token}&invite=1`;
    const delivered = await mailer.sendInvitation({ email: user.email, name: user.name }, inviteUrl);

    await activityService.log({
      userId: actorId,
      action: "user.create",
      module: "users",
      entityId: user.id,
      after: { email: user.email, roles: user.roleKeys },
      ...meta,
    });
    // Only expose the link to the creating admin when no email provider delivered it.
    return { user: publicUser(user), inviteUrl: delivered ? undefined : inviteUrl };
  },

  async update(
    actorId: string,
    id: string,
    input: { name?: string; isActive?: boolean; roleKeys?: string[] },
    meta: RequestMeta,
  ) {
    const target = await userRepository.findById(id);
    if (!target) throw AppError.notFound("User not found");

    const deactivating = input.isActive === false && target.isActive;
    const losingSuperAdmin =
      input.roleKeys !== undefined && target.roleKeys.includes("SUPER_ADMIN") && !input.roleKeys.includes("SUPER_ADMIN");

    if (id === actorId && (deactivating || losingSuperAdmin)) {
      throw new AppError(409, "SELF_LOCKOUT", "You cannot deactivate or demote your own account");
    }
    if (deactivating || losingSuperAdmin) await assertNotLastSuperAdmin(target);
    if (input.roleKeys) await assertRolesExist(input.roleKeys);

    const updated = await userRepository.update(id, input);
    if (deactivating) await sessionRepository.revokeAllForUser(id);

    await activityService.log({
      userId: actorId,
      action: "user.update",
      module: "users",
      entityId: id,
      before: { name: target.name, isActive: target.isActive, roles: target.roleKeys },
      after: { name: updated.name, isActive: updated.isActive, roles: updated.roleKeys },
      ...meta,
    });
    return publicUser(updated);
  },

  async remove(actorId: string, id: string, meta: RequestMeta) {
    if (id === actorId) throw new AppError(409, "SELF_LOCKOUT", "You cannot delete your own account");
    const target = await userRepository.findById(id);
    if (!target) throw AppError.notFound("User not found");
    await assertNotLastSuperAdmin(target);

    await sessionRepository.revokeAllForUser(id);
    await userRepository.softDelete(id);
    await activityService.log({
      userId: actorId,
      action: "user.delete",
      module: "users",
      entityId: id,
      before: { email: target.email, roles: target.roleKeys },
      ...meta,
    });
  },

  async restore(actorId: string, id: string, meta: RequestMeta) {
    const target = await userRepository.findByIdIncludingDeleted(id);
    if (!target) throw AppError.notFound("User not found");
    if (!target.deletedAt) throw new AppError(409, "NOT_DELETED", "This user is not deleted");

    const restored = await userRepository.restore(id);
    await activityService.log({
      userId: actorId,
      action: "user.restore",
      module: "users",
      entityId: id,
      after: { email: restored.email, isActive: restored.isActive },
      ...meta,
    });
    return publicUser(restored);
  },

  listRoles: () => roleRepository.listWithPermissions(),
  listPermissions: () => roleRepository.listPermissions(),

  async setRolePermissions(actorId: string, roleId: string, keys: string[], meta: RequestMeta) {
    const role = await roleRepository.findById(roleId);
    if (!role) throw AppError.notFound("Role not found");
    if (role.key === "SUPER_ADMIN") {
      throw new AppError(409, "ROLE_IMMUTABLE", "The Super Admin role always has every permission");
    }
    const unknown = keys.filter((k) => !(ALL_PERMISSIONS as string[]).includes(k));
    if (unknown.length) throw AppError.badRequest(`Unknown permission(s): ${unknown.join(", ")}`);

    await roleRepository.setPermissions(roleId, keys);
    await activityService.log({
      userId: actorId,
      action: "role.update_permissions",
      module: "users",
      entityId: roleId,
      after: { role: role.key, permissions: keys },
      ...meta,
    });
  },
};
