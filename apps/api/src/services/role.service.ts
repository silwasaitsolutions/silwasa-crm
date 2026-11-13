import { ALL_PERMISSIONS } from "../rbac/catalog";
import { roleRepository } from "../repositories/role.repository";
import type { RequestMeta } from "../types/auth";
import { AppError } from "../utils/app-error";
import { activityService } from "./activity.service";

function assertKnownPermissions(keys: string[]) {
  const unknown = keys.filter((k) => !(ALL_PERMISSIONS as string[]).includes(k));
  if (unknown.length) throw AppError.badRequest(`Unknown permission(s): ${unknown.join(", ")}`);
}

/** Custom role management. System roles keep their key and cannot be deleted. */
export const roleService = {
  async create(
    actorId: string,
    input: { key: string; name: string; description?: string; permissions: string[] },
    meta: RequestMeta,
  ) {
    if ((await roleRepository.existingKeys([input.key])).length) {
      throw new AppError(409, "ROLE_KEY_IN_USE", "A role with this key already exists");
    }
    assertKnownPermissions(input.permissions);
    const role = await roleRepository.create({
      key: input.key,
      name: input.name,
      description: input.description,
      permissionKeys: input.permissions,
    });
    await activityService.log({
      userId: actorId,
      action: "role.create",
      module: "users",
      entityId: role.id,
      after: { key: input.key, name: input.name, permissions: input.permissions },
      ...meta,
    });
    return { id: role.id, key: role.key };
  },

  async update(
    actorId: string,
    id: string,
    input: { name?: string; description?: string | null },
    meta: RequestMeta,
  ) {
    const role = await roleRepository.findById(id);
    if (!role) throw AppError.notFound("Role not found");
    await roleRepository.update(id, input);
    await activityService.log({
      userId: actorId,
      action: "role.update",
      module: "users",
      entityId: id,
      before: { name: role.name, description: role.description },
      after: input,
      ...meta,
    });
  },

  async remove(actorId: string, id: string, meta: RequestMeta) {
    const role = await roleRepository.findById(id);
    if (!role) throw AppError.notFound("Role not found");
    if (role.isSystem) throw new AppError(409, "ROLE_IMMUTABLE", "System roles cannot be deleted");
    if ((await roleRepository.countUsers(id)) > 0) {
      throw new AppError(409, "ROLE_IN_USE", "Reassign the users with this role before deleting it");
    }
    await roleRepository.remove(id);
    await activityService.log({
      userId: actorId,
      action: "role.delete",
      module: "users",
      entityId: id,
      before: { key: role.key, name: role.name },
      ...meta,
    });
  },
};
