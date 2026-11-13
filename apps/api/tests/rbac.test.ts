import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { ALL_PERMISSIONS, ROLE_DEFINITIONS, SYSTEM_ROLES } from "../src/rbac/catalog";
import { as, login } from "./helpers/app";
import { db, resetDb, roleId, seedUser, sentMail } from "./helpers/fake-db";

const app = createApp();
const PASSWORD = "correct-horse-battery";

async function sessionFor(email: string, role: (typeof SYSTEM_ROLES)[number]) {
  await seedUser({ email, password: PASSWORD, roles: [role] });
  return (await login(app, email, PASSWORD)).session;
}

beforeEach(() => {
  resetDb();
  sentMail.length = 0;
});

describe("permission catalog", () => {
  it("gives SUPER_ADMIN everything and keeps user management away from other roles", () => {
    expect(ROLE_DEFINITIONS.SUPER_ADMIN.permissions).toEqual(ALL_PERMISSIONS);
    for (const role of ["ADMIN", "EDITOR", "SEO_MANAGER"] as const) {
      expect(ROLE_DEFINITIONS[role].permissions.some((p) => p.startsWith("users:") || p === "roles:manage")).toBe(false);
    }
  });

  it("only references permissions that exist", () => {
    for (const def of Object.values(ROLE_DEFINITIONS)) {
      for (const p of def.permissions) expect(ALL_PERMISSIONS).toContain(p);
    }
  });

  it("lets editors work on content but not publish pages; SEO managers manage redirects", () => {
    expect(ROLE_DEFINITIONS.EDITOR.permissions).toContain("blog:update");
    expect(ROLE_DEFINITIONS.EDITOR.permissions).not.toContain("pages:publish");
    expect(ROLE_DEFINITIONS.SEO_MANAGER.permissions).toContain("redirects:manage");
  });
});

describe("authorization enforced on the server", () => {
  it("returns 401 for anonymous callers on every admin user endpoint", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const calls = [
      request(app).get("/api/v1/admin/users"),
      request(app).get(`/api/v1/admin/users/${id}`),
      request(app).get("/api/v1/admin/roles"),
      request(app).get("/api/v1/admin/permissions"),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(401);
  });

  it.each(["ADMIN", "EDITOR", "SEO_MANAGER"] as const)("%s cannot manage users or roles (403)", async (role) => {
    const s = await sessionFor(`${role.toLowerCase()}@silwasa.test`, role);
    expect((await as(app, s).get("/api/v1/admin/users")).status).toBe(403);
    expect((await as(app, s).get("/api/v1/admin/roles")).status).toBe(403);
    const create = await as(app, s).post("/api/v1/admin/users").send({ email: "n@silwasa.test", name: "N", roleKeys: ["EDITOR"] });
    expect(create.status).toBe(403);
    expect(db.users.size).toBe(1);
  });

  it("allows SUPER_ADMIN to list users with pagination metadata", async () => {
    const s = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const res = await as(app, s).get("/api/v1/admin/users?pageSize=1");
    expect(res.status).toBe(200);
    expect(res.body.meta.pagination).toMatchObject({ page: 1, pageSize: 1, total: 1, totalPages: 1 });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it("applies permission changes immediately, without requiring a new login", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const editor = await sessionFor("ed@silwasa.test", "EDITOR");
    expect((await as(app, editor).get("/api/v1/admin/users")).status).toBe(403);

    const put = await as(app, root)
      .put(`/api/v1/admin/roles/${roleId("EDITOR")}/permissions`)
      .send({ permissions: ["users:read", "pages:read"] });
    expect(put.status).toBe(204);
    expect((await as(app, editor).get("/api/v1/admin/users")).status).toBe(200);
    expect((await as(app, editor).post("/api/v1/admin/users").send({ email: "n@silwasa.test", name: "N", roleKeys: ["EDITOR"] })).status).toBe(403);
  });

  it("keeps the SUPER_ADMIN role immutable and rejects unknown permissions", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const immutable = await as(app, root).put(`/api/v1/admin/roles/${roleId("SUPER_ADMIN")}/permissions`).send({ permissions: [] });
    expect(immutable.status).toBe(409);
    const unknown = await as(app, root).put(`/api/v1/admin/roles/${roleId("EDITOR")}/permissions`).send({ permissions: ["made:up"] });
    expect(unknown.status).toBe(400);
  });
});

describe("user management", () => {
  it("creates a user with an invitation link and never trusts client-supplied roles blindly", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const res = await as(app, root).post("/api/v1/admin/users").send({ email: "New@Silwasa.test", name: "New Editor", roleKeys: ["EDITOR"] });
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe("new@silwasa.test");
    expect(res.body.data.inviteUrl).toContain("/admin/reset-password?token=");
    expect(sentMail[0]).toMatchObject({ kind: "invite", email: "new@silwasa.test" });

    const bad = await as(app, root).post("/api/v1/admin/users").send({ email: "x@silwasa.test", name: "X", roleKeys: ["GOD_MODE"] });
    expect(bad.status).toBe(400);
  });

  it("lets an invited user set a password via the invitation token and sign in", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const created = await as(app, root).post("/api/v1/admin/users").send({ email: "inv@silwasa.test", name: "Inv", roleKeys: ["SEO_MANAGER"] });
    const token = new URL(created.body.data.inviteUrl).searchParams.get("token")!;
    const set = await request(app).post("/api/v1/auth/reset-password").send({ token, password: "my-first-passphrase" });
    expect(set.status).toBe(200);
    const { res } = await login(app, "inv@silwasa.test", "my-first-passphrase");
    expect(res.status).toBe(200);
    expect(res.body.data.user.roleKeys).toEqual(["SEO_MANAGER"]);
  });

  it("rejects duplicate emails and invalid input", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const dup = await as(app, root).post("/api/v1/admin/users").send({ email: "root@silwasa.test", name: "Dup", roleKeys: ["EDITOR"] });
    expect(dup.status).toBe(409);
    const invalid = await as(app, root).post("/api/v1/admin/users").send({ email: "nope", name: "", roleKeys: [] });
    expect(invalid.status).toBe(422);
    const badId = await as(app, root).get("/api/v1/admin/users/not-a-uuid");
    expect(badId.status).toBe(422);
  });

  it("deactivating a user signs them out immediately", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const editor = await sessionFor("ed@silwasa.test", "EDITOR");
    const editorUser = [...db.users.values()].find((u) => u.email === "ed@silwasa.test")!;
    const res = await as(app, root).put(`/api/v1/admin/users/${editorUser.id}`).send({ isActive: false });
    expect(res.status).toBe(200);
    expect((await as(app, editor).get("/api/v1/auth/me")).status).toBe(401);
  });

  it("prevents users from deleting or demoting themselves", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const self = [...db.users.values()][0]!;
    expect((await as(app, root).del(`/api/v1/admin/users/${self.id}`)).status).toBe(409);
    expect((await as(app, root).put(`/api/v1/admin/users/${self.id}`).send({ isActive: false })).status).toBe(409);
    expect((await as(app, root).put(`/api/v1/admin/users/${self.id}`).send({ roleKeys: ["EDITOR"] })).status).toBe(409);
    expect(db.users.get(self.id)!.isActive).toBe(true);
  });

  it("never lets the last active Super Admin be removed, even by a delegated user manager", async () => {
    await seedUser({ email: "only@silwasa.test", password: PASSWORD, roles: ["SUPER_ADMIN"] });
    const only = [...db.users.values()][0]!;
    // Delegate user management to the EDITOR role (a custom configuration a Super Admin could create).
    db.rolePermissions.get("EDITOR")!.add("users:update").add("users:delete");
    const editor = await sessionFor("ed@silwasa.test", "EDITOR");

    const del = await as(app, editor).del(`/api/v1/admin/users/${only.id}`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe("LAST_SUPER_ADMIN");
    const demote = await as(app, editor).put(`/api/v1/admin/users/${only.id}`).send({ roleKeys: ["EDITOR"] });
    expect(demote.status).toBe(409);
    expect(db.users.get(only.id)!.roleKeys).toContain("SUPER_ADMIN");

    // With a second active Super Admin the first can be demoted.
    await seedUser({ email: "second@silwasa.test", password: PASSWORD, roles: ["SUPER_ADMIN"] });
    expect((await as(app, editor).put(`/api/v1/admin/users/${only.id}`).send({ roleKeys: ["EDITOR"] })).status).toBe(200);
  });

  it("soft-deletes users, frees the email, and records an audit entry", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const editor = await seedUser({ email: "gone@silwasa.test", password: PASSWORD, roles: ["EDITOR"] });
    expect((await as(app, root).del(`/api/v1/admin/users/${editor.id}`)).status).toBe(204);
    expect(db.users.get(editor.id)!.deletedAt).not.toBeNull();
    expect((await as(app, root).get(`/api/v1/admin/users/${editor.id}`)).status).toBe(404);
    expect(db.activities.some((a) => a.action === "user.delete" && a.entityId === editor.id)).toBe(true);
  });
});
