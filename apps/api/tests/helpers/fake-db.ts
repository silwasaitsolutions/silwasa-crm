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

const roleIds = new Map<string, string>();
/** Real role ids are UUIDs, so the fake uses stable UUIDs too (route params are validated as UUIDs). */
export const roleId = (key: string) => {
  if (!roleIds.has(key)) roleIds.set(key, randomUUID());
  return roleIds.get(key)!;
};
const keyForId = (id: string) => [...roleIds.entries()].find(([, v]) => v === id)?.[0];

export function resetDb() {
  db.users.clear();
  db.sessions.clear();
  db.tokens.length = 0;
  db.activities.length = 0;
  db.rolePermissions.clear();
  for (const [key, def] of Object.entries(ROLE_DEFINITIONS)) {
    db.rolePermissions.set(key, new Set(def.permissions));
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
  async list(opts: { page: number; pageSize: number; search?: string }) {
    const all = [...db.users.values()].filter(
      (u) => !u.deletedAt && (!opts.search || u.email.includes(opts.search) || u.name.includes(opts.search)),
    );
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
    u.email = `deleted+${id}@invalid.local`;
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
    return [...db.rolePermissions.entries()].map(([key, perms]) => ({
      id: roleId(key), key, name: key, description: null, isSystem: true,
      userCount: [...db.users.values()].filter((u) => u.roleKeys.includes(key)).length,
      permissions: [...perms].sort(),
    }));
  },
  async listPermissions() {
    return ALL_PERMISSIONS.map((key) => ({ key, module: key.split(":")[0]!, description: null }));
  },
  async findById(id: string) {
    const key = keyForId(id);
    return key && db.rolePermissions.has(key) ? { id, key } : null;
  },
  async setPermissions(id: string, keys: string[]) {
    db.rolePermissions.set(keyForId(id)!, new Set(keys));
  },
  async existingKeys(keys: string[]) {
    return keys.filter((k) => db.rolePermissions.has(k));
  },
};

export const activityRepository = {
  async create(input: Record<string, unknown>) {
    db.activities.push(input);
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
  const { passwordService } = await import("../../src/services/password.service");
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
