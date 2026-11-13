import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { SystemRoleKey } from "../src/rbac/catalog";
import { as, login } from "./helpers/app";
import { db, resetDb, roleId, seedUser, sentMail } from "./helpers/fake-db";

const app = createApp();
const PASSWORD = "correct-horse-battery";

async function sessionFor(email: string, role: SystemRoleKey) {
  await seedUser({ email, password: PASSWORD, roles: [role], name: email.split("@")[0] });
  return (await login(app, email, PASSWORD)).session;
}

beforeEach(() => {
  resetDb();
  sentMail.length = 0;
});

describe("user list filters", () => {
  it("filters by status, role and search, and paginates", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    await seedUser({ email: "ann@silwasa.test", password: PASSWORD, roles: ["EDITOR"], name: "Ann" });
    await seedUser({ email: "bob@silwasa.test", password: PASSWORD, roles: ["EDITOR"], name: "Bob", isActive: false });
    const gone = await seedUser({ email: "cat@silwasa.test", password: PASSWORD, roles: ["SEO_MANAGER"], name: "Cat" });
    await as(app, root).del(`/api/v1/admin/users/${gone.id}`);

    const emails = async (qs: string) =>
      ((await as(app, root).get(`/api/v1/admin/users${qs}`)).body.data as Array<{ email: string }>).map((u) => u.email).sort();

    expect(await emails("")).toEqual(["ann@silwasa.test", "bob@silwasa.test", "root@silwasa.test"]);
    expect(await emails("?status=active")).toEqual(["ann@silwasa.test", "root@silwasa.test"]);
    expect(await emails("?status=inactive")).toEqual(["bob@silwasa.test"]);
    expect(await emails("?status=deleted")).toEqual(["cat@silwasa.test"]);
    expect(await emails("?role=EDITOR")).toEqual(["ann@silwasa.test", "bob@silwasa.test"]);
    expect(await emails("?search=ann")).toEqual(["ann@silwasa.test"]);

    const page = await as(app, root).get("/api/v1/admin/users?pageSize=2&page=2");
    expect(page.body.meta.pagination).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
    expect(page.body.data).toHaveLength(1);

    expect((await as(app, root).get("/api/v1/admin/users?status=bogus")).status).toBe(422);
  });
});

describe("restore", () => {
  it("restores a soft-deleted user as inactive, keeps the email, and audits it", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const user = await seedUser({ email: "back@silwasa.test", password: PASSWORD, roles: ["EDITOR"] });
    await as(app, root).del(`/api/v1/admin/users/${user.id}`);
    expect(db.users.get(user.id)!.email).toBe("back@silwasa.test");
    expect((await login(app, "back@silwasa.test", PASSWORD)).res.status).toBe(401);

    const res = await as(app, root).post(`/api/v1/admin/users/${user.id}/restore`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: "back@silwasa.test", isActive: false, deletedAt: null });
    expect(db.activities.some((a) => a.action === "user.restore" && a.entityId === user.id)).toBe(true);

    // Still cannot sign in until an admin re-activates the account.
    expect((await login(app, "back@silwasa.test", PASSWORD)).res.status).toBe(401);
    await as(app, root).put(`/api/v1/admin/users/${user.id}`).send({ isActive: true });
    expect((await login(app, "back@silwasa.test", PASSWORD)).res.status).toBe(200);
  });

  it("rejects restoring a user who is not deleted, unknown ids, and callers without users:update", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const editor = await sessionFor("ed@silwasa.test", "EDITOR");
    const live = await seedUser({ email: "live@silwasa.test", password: PASSWORD, roles: ["EDITOR"] });

    expect((await as(app, root).post(`/api/v1/admin/users/${live.id}/restore`).send({})).status).toBe(409);
    expect((await as(app, root).post("/api/v1/admin/users/00000000-0000-4000-8000-000000000000/restore").send({})).status).toBe(404);
    expect((await as(app, editor).post(`/api/v1/admin/users/${live.id}/restore`).send({})).status).toBe(403);
  });

  it("blocks creating a user with the email of a deleted user and points to restore", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const user = await seedUser({ email: "dup@silwasa.test", password: PASSWORD, roles: ["EDITOR"] });
    await as(app, root).del(`/api/v1/admin/users/${user.id}`);
    const res = await as(app, root).post("/api/v1/admin/users").send({ email: "dup@silwasa.test", name: "Dup", roleKeys: ["EDITOR"] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_DELETED");
  });
});

describe("custom roles", () => {
  it("creates, edits, and deletes a custom role with validation and audit entries", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const create = await as(app, root)
      .post("/api/v1/admin/roles")
      .send({ key: "content_reviewer", name: "Content Reviewer", description: "Reviews posts", permissions: ["blog:read", "pages:read"] });
    expect(create.status).toBe(201);
    expect(create.body.data.key).toBe("CONTENT_REVIEWER");
    const id = create.body.data.id as string;

    const roles = (await as(app, root).get("/api/v1/admin/roles")).body.data as Array<{ key: string; isSystem: boolean; permissions: string[] }>;
    const custom = roles.find((r) => r.key === "CONTENT_REVIEWER")!;
    expect(custom).toMatchObject({ isSystem: false, permissions: ["blog:read", "pages:read"] });

    expect((await as(app, root).put(`/api/v1/admin/roles/${id}`).send({ name: "Reviewer", description: null })).status).toBe(204);
    expect((await as(app, root).put(`/api/v1/admin/roles/${id}`).send({})).status).toBe(422);
    expect((await as(app, root).del(`/api/v1/admin/roles/${id}`)).status).toBe(204);
    expect(db.activities.map((a) => a.action)).toEqual(expect.arrayContaining(["role.create", "role.update", "role.delete"]));
  });

  it("rejects duplicate keys, unknown permissions and bad input", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    const dup = await as(app, root).post("/api/v1/admin/roles").send({ key: "EDITOR", name: "Again", permissions: [] });
    expect(dup.status).toBe(409);
    const unknown = await as(app, root).post("/api/v1/admin/roles").send({ key: "X_ROLE", name: "X", permissions: ["made:up"] });
    expect(unknown.status).toBe(400);
    const invalid = await as(app, root).post("/api/v1/admin/roles").send({ key: "1bad key", name: "" });
    expect(invalid.status).toBe(422);
  });

  it("never deletes system roles or roles that still have users", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    expect((await as(app, root).del(`/api/v1/admin/roles/${roleId("EDITOR")}`)).status).toBe(409);

    const created = await as(app, root).post("/api/v1/admin/roles").send({ key: "TEMP_ROLE", name: "Temp", permissions: [] });
    await as(app, root).post("/api/v1/admin/users").send({ email: "t@silwasa.test", name: "T", roleKeys: ["TEMP_ROLE"] });
    const inUse = await as(app, root).del(`/api/v1/admin/roles/${created.body.data.id}`);
    expect(inUse.status).toBe(409);
    expect(inUse.body.error.code).toBe("ROLE_IN_USE");
  });

  it("requires roles:manage for changes, but lets user managers read roles to assign them", async () => {
    const editor = await sessionFor("ed@silwasa.test", "EDITOR");
    expect((await as(app, editor).get("/api/v1/admin/roles")).status).toBe(403);
    expect((await as(app, editor).post("/api/v1/admin/roles").send({ key: "NOPE", name: "Nope", permissions: [] })).status).toBe(403);

    db.rolePermissions.get("EDITOR")!.add("users:read");
    expect((await as(app, editor).get("/api/v1/admin/roles")).status).toBe(200);
    expect((await as(app, editor).post("/api/v1/admin/roles").send({ key: "NOPE", name: "Nope", permissions: [] })).status).toBe(403);
  });
});

describe("dashboard", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/api/v1/admin/dashboard")).status).toBe(401);
  });

  it("returns real counts and recent activity for a Super Admin, with unavailable modules flagged", async () => {
    const root = await sessionFor("root@silwasa.test", "SUPER_ADMIN");
    await seedUser({ email: "off@silwasa.test", password: PASSWORD, roles: ["EDITOR"], isActive: false });
    const res = await as(app, root).get("/api/v1/admin/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual({ total: 2, active: 1, inactive: 1, deleted: 0 });
    expect(res.body.data.recentActivity[0]).toMatchObject({ action: "auth.login", module: "auth" });
    expect(res.body.data.modules).toEqual({
      pages: { available: false, phase: 5 },
      posts: { available: false, phase: 7 },
      enquiries: { available: false, phase: 9 },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|ipAddress|userAgent/);
  });

  it("withholds user stats and activity from roles without the matching permissions", async () => {
    const editor = await sessionFor("ed@silwasa.test", "EDITOR");
    const res = await as(app, editor).get("/api/v1/admin/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.data.users).toBeNull();
    expect(res.body.data.recentActivity).toBeNull();
  });
});
