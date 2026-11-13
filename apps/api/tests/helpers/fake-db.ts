/**
 * In-memory replacements for the Prisma-backed repositories so auth/RBAC behaviour can be tested
 * without a database. Tests must never be pointed at a real (e.g. Supabase) database.
 */
import { randomUUID } from "node:crypto";
import { ALL_PERMISSIONS, ROLE_DEFINITIONS, type SystemRoleKey } from "../../src/rbac/catalog";
import type { SessionRecord, UserRecord } from "../../src/types/auth";

interface StoredUser extends Omit<UserRecord, "permissions" | "roleKeys"> {
  roleKeys: string[];
  deletedAt: Date | null;
}
interface StoredToken { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }

export const db = {
  users: new Map<string, StoredUser>(),
  sessions: new Map<string, SessionRecord>(),
  tokens: [] as StoredToken[],
  activities: [] as Array<Record<string, unknown>>,
  rolePermissions: new Map<string, Set<string>>(),
};

interface RoleMeta { id: string; key: string; name: string; description: string | null; isSystem: boolean }
const roleMeta = new Map<string, RoleMeta>();
/** Real role ids are UUIDs, so the fake uses stable UUIDs too (route params are validated as UUIDs). */
export const roleId = (key: string) => {
  const existing = roleMeta.get(key);
  if (existing) return existing.id;
  roleMeta.set(key, { id: randomUUID(), key, name: key, description: null, isSystem: true });
  return roleMeta.get(key)!.id;
};
const keyForId = (id: string) => [...roleMeta.values()].find((r) => r.id === id)?.key;

export function resetDb() {
  db.users.clear();
  db.sessions.clear();
  db.tokens.length = 0;
  db.activities.length = 0;
  db.rolePermissions.clear();
  roleMeta.clear();
  for (const [key, def] of Object.entries(ROLE_DEFINITIONS)) {
    db.rolePermissions.set(key, new Set(def.permissions));
    roleId(key);
    roleMeta.get(key)!.name = def.name;
  }
}
resetDb();

const permsFor = (roleKeys: string[]) => [
  ...new Set(roleKeys.flatMap((k) => [...(db.rolePermissions.get(k) ?? [])])),
];
const toRecord = (u: StoredUser): UserRecord => ({ ...u, permissions: permsFor(u.roleKeys) });
const live = (u?: StoredUser) => (u && !u.deletedAt ? toRecord(u) : null);

export const userRepository = {
  async findByEmail(email: string) {
    return live([...db.users.values()].find((u) => u.email === email.trim().toLowerCase() && !u.deletedAt));
  },
  async findById(id: string) {
    return live(db.users.get(id));
  },
  async findByIdIncludingDeleted(id: string) {
    const u = db.users.get(id);
    return u ? toRecord(u) : null;
  },
  async findByEmailIncludingDeleted(email: string) {
    const u = [...db.users.values()].find((x) => x.email === email.trim().toLowerCase());
    return u ? toRecord(u) : null;
  },
  async restore(id: string) {
    const u = db.users.get(id)!;
    Object.assign(u, { deletedAt: null, isActive: false, failedLoginAttempts: 0, lockedUntil: null });
    return toRecord(u);
  },
  async counts() {
    const live = [...db.users.values()].filter((u) => !u.deletedAt);
    const active = live.filter((u) => u.isActive).length;
    return { total: live.length, active, inactive: live.length - active, deleted: db.users.size - live.length };
  },
  async list(opts: {
    page: number;
    pageSize: number;
    search?: string;
    status?: "active" | "inactive" | "deleted";
    roleKey?: string;
  }) {
    const all = [...db.users.values()].filter((u) => {
      const statusOk =
        opts.status === "deleted" ? !!u.deletedAt
        : u.deletedAt ? false
        : opts.status === "active" ? u.isActive
        : opts.status === "inactive" ? !u.isActive
        : true;
      const roleOk = !opts.roleKey || u.roleKeys.includes(opts.roleKey);
      const searchOk = !opts.search || u.email.includes(opts.search) || u.name.includes(opts.search);
      return statusOk && roleOk && searchOk;
    });
    const start = (opts.page - 1) * opts.pageSize;
    return { items: all.slice(start, start + opts.pageSize).map(toRecord), total: all.length };
  },
  async create(data: { email: string; name: string; passwordHash: string; roleKeys: string[] }) {
    const u: StoredUser = {
      id: randomUUID(), email: data.email.toLowerCase(), name: data.name, isActive: true,
      passwordHash: data.passwordHash, failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: null,
      createdAt: new Date(), roleKeys: data.roleKeys, deletedAt: null,
    };
    db.users.set(u.id, u);
    return toRecord(u);
  },
  async update(id: string, data: { name?: string; isActive?: boolean; roleKeys?: string[] }) {
    const u = db.users.get(id)!;
    if (data.name !== undefined) u.name = data.name;
    if (data.isActive !== undefined) u.isActive = data.isActive;
    if (data.roleKeys) u.roleKeys = data.roleKeys;
    return toRecord(u);
  },
  async softDelete(id: string) {
    const u = db.users.get(id)!;
    u.deletedAt = new Date();
    u.isActive = false;
  },
  async countActiveSuperAdmins(excludeUserId?: string) {
    return [...db.users.values()].filter(
      (u) => !u.deletedAt && u.isActive && u.id !== excludeUserId && u.roleKeys.includes("SUPER_ADMIN"),
    ).length;
  },
  async registerFailedLogin(id: string, attempts: number, lockedUntil: Date | null) {
    Object.assign(db.users.get(id)!, { failedLoginAttempts: attempts, lockedUntil });
  },
  async registerSuccessfulLogin(id: string) {
    Object.assign(db.users.get(id)!, { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() });
  },
  async setPassword(id: string, passwordHash: string) {
    Object.assign(db.users.get(id)!, { passwordHash, failedLoginAttempts: 0, lockedUntil: null });
  },
};

export const sessionRepository = {
  async create(d: { userId: string; refreshTokenHash: string; expiresAt: Date }) {
    const s: SessionRecord = { id: randomUUID(), userId: d.userId, refreshTokenHash: d.refreshTokenHash, expiresAt: d.expiresAt, revokedAt: null };
    db.sessions.set(s.id, s);
    return { ...s };
  },
  async findById(id: string) {
    const s = db.sessions.get(id);
    return s ? { ...s } : null;
  },
  async findByRefreshHash(hash: string) {
    const s = [...db.sessions.values()].find((x) => x.refreshTokenHash === hash);
    return s ? { ...s } : null;
  },
  async rotate(id: string, oldHash: string, newHash: string, expiresAt: Date) {
    const s = db.sessions.get(id);
    if (!s || s.refreshTokenHash !== oldHash || s.revokedAt) return false;
    s.refreshTokenHash = newHash;
    s.expiresAt = expiresAt;
    return true;
  },
  async revoke(id: string) {
    const s = db.sessions.get(id);
    if (s && !s.revokedAt) s.revokedAt = new Date();
  },
  async revokeAllForUser(userId: string, exceptSessionId?: string) {
    for (const s of db.sessions.values()) {
      if (s.userId === userId && s.id !== exceptSessionId && !s.revokedAt) s.revokedAt = new Date();
    }
  },
};

export const resetTokenRepository = {
  async create(userId: string, tokenHash: string, expiresAt: Date) {
    db.tokens.filter((t) => t.userId === userId && !t.usedAt).forEach((t) => (t.usedAt = new Date()));
    db.tokens.push({ id: randomUUID(), userId, tokenHash, expiresAt, usedAt: null });
  },
  async findValidByHash(hash: string) {
    const t = db.tokens.find((x) => x.tokenHash === hash && !x.usedAt && x.expiresAt > new Date());
    return t ? { id: t.id, userId: t.userId } : null;
  },
  async complete(tokenId: string, userId: string, passwordHash: string) {
    const t = db.tokens.find((x) => x.id === tokenId);
    if (!t || t.usedAt) return false;
    t.usedAt = new Date();
    await userRepository.setPassword(userId, passwordHash);
    await sessionRepository.revokeAllForUser(userId);
    return true;
  },
};

export const roleRepository = {
  async listWithPermissions() {
    return [...roleMeta.values()].map((m) => ({
      id: m.id, key: m.key, name: m.name, description: m.description, isSystem: m.isSystem,
      userCount: [...db.users.values()].filter((u) => !u.deletedAt && u.roleKeys.includes(m.key)).length,
      permissions: [...(db.rolePermissions.get(m.key) ?? [])].sort(),
    }));
  },
  async listPermissions() {
    return ALL_PERMISSIONS.map((key) => ({ key, module: key.split(":")[0]!, description: null }));
  },
  async findById(id: string) {
    const key = keyForId(id);
    return key ? { ...roleMeta.get(key)! } : null;
  },
  async countUsers(id: string) {
    const key = keyForId(id)!;
    return [...db.users.values()].filter((u) => !u.deletedAt && u.roleKeys.includes(key)).length;
  },
  async create(data: { key: string; name: string; description?: string; permissionKeys: string[] }) {
    const id = randomUUID();
    roleMeta.set(data.key, { id, key: data.key, name: data.name, description: data.description ?? null, isSystem: false });
    db.rolePermissions.set(data.key, new Set(data.permissionKeys));
    return { id, key: data.key };
  },
  async update(id: string, data: { name?: string; description?: string | null }) {
    Object.assign(roleMeta.get(keyForId(id)!)!, data);
  },
  async remove(id: string) {
    const key = keyForId(id)!;
    roleMeta.delete(key);
    db.rolePermissions.delete(key);
  },
  async setPermissions(id: string, keys: string[]) {
    db.rolePermissions.set(keyForId(id)!, new Set(keys));
  },
  async existingKeys(keys: string[]) {
    return keys.filter((k) => roleMeta.has(k));
  },
};

export const activityRepository = {
  async create(input: Record<string, unknown>) {
    db.activities.push({ ...input, createdAt: new Date(), id: randomUUID() });
  },
  async listRecent(limit: number) {
    return [...db.activities].reverse().slice(0, limit).map((a) => ({
      id: a.id, action: a.action, module: a.module, entityId: a.entityId ?? null, createdAt: a.createdAt,
      actor: a.userId ? { name: "Actor", email: "actor@silwasa.test" } : null,
    }));
  },
};

export const sentMail: Array<{ kind: string; email: string; url: string }> = [];

export async function seedUser(opts: {
  email: string;
  password: string;
  roles: SystemRoleKey[];
  name?: string;
  isActive?: boolean;
}) {
  const { passwordService } = await import("../../src/services/password.service.js");
  return userRepository.create({
    email: opts.email,
    name: opts.name ?? "Test User",
    passwordHash: await passwordService.hash(opts.password),
    roleKeys: opts.roles,
  }).then(async (u) => {
    if (opts.isActive === false) await userRepository.update(u.id, { isActive: false });
    return u;
  });
}
