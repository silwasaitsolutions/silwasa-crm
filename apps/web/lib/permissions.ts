import type { AdminPermission } from "@silwasa/shared";

interface PermissionSubject {
  roleKeys: string[];
  permissions: string[];
}

/** UI-only convenience. The API enforces every permission independently. */
export function can(user: PermissionSubject | null | undefined, permission: string): boolean {
  if (!user) return false;
  return user.roleKeys.includes("SUPER_ADMIN") || user.permissions.includes(permission);
}

export const titleCase = (value: string) =>
  value
    .split(/[-_:\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export interface PermissionGroup {
  module: string;
  label: string;
  permissions: Array<{ key: string; label: string }>;
}

/** Groups permission keys by module for the permission matrix, preserving catalog order. */
export function groupPermissions(permissions: Pick<AdminPermission, "key" | "module">[]): PermissionGroup[] {
  const groups = new Map<string, PermissionGroup>();
  for (const p of permissions) {
    const group = groups.get(p.module) ?? { module: p.module, label: titleCase(p.module), permissions: [] };
    group.permissions.push({ key: p.key, label: titleCase(p.key.split(":")[1] ?? p.key) });
    groups.set(p.module, group);
  }
  return [...groups.values()];
}
