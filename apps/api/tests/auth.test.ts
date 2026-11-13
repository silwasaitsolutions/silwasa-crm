import { SignJWT } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { MAX_FAILED_ATTEMPTS } from "../src/services/auth.service";
import { as, login, parseSession } from "./helpers/app";
import { db, resetDb, seedUser, sentMail } from "./helpers/fake-db";

const app = createApp();
const PASSWORD = "correct-horse-battery";

beforeEach(async () => {
  resetDb();
  sentMail.length = 0;
  await seedUser({ email: "admin@silwasa.test", password: PASSWORD, roles: ["SUPER_ADMIN"] });
});

describe("login", () => {
  it("signs in and sets hardened cookies without leaking secrets", async () => {
    const { res } = await login(app, "admin@silwasa.test", PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("admin@silwasa.test");
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);

    const cookies = res.headers["set-cookie"] as unknown as string[];
    const access = cookies.find((c) => c.startsWith("sw_access="))!;
    const refresh = cookies.find((c) => c.startsWith("sw_refresh="))!;
    const csrf = cookies.find((c) => c.startsWith("sw_csrf="))!;
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=Lax/i);
    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
    expect(csrf).not.toMatch(/HttpOnly/i);
  });

  it("stores only a hash of the refresh token", async () => {
    const { session } = await login(app, "admin@silwasa.test", PASSWORD);
    const stored = [...db.sessions.values()][0]!;
    expect(stored.refreshTokenHash).not.toBe(session.get("sw_refresh"));
    expect(stored.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a wrong password and an unknown email with the same generic error", async () => {
    const wrong = await request(app).post("/api/v1/auth/login").send({ email: "admin@silwasa.test", password: "nope-nope-nope" });
    const unknown = await request(app).post("/api/v1/auth/login").send({ email: "ghost@silwasa.test", password: "nope-nope-nope" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
    expect(wrong.headers["set-cookie"]).toBeUndefined();
  });

  it("validates the request body", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("locks the account after repeated failures, even for the correct password", async () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await request(app).post("/api/v1/auth/login").send({ email: "admin@silwasa.test", password: "wrong-wrong-wrong" });
    }
    const locked = await request(app).post("/api/v1/auth/login").send({ email: "admin@silwasa.test", password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("does not allow deactivated users to sign in", async () => {
    await seedUser({ email: "off@silwasa.test", password: PASSWORD, roles: ["EDITOR"], isActive: false });
    const { res } = await login(app, "off@silwasa.test", PASSWORD);
    expect(res.status).toBe(401);
  });

  it("never writes passwords or tokens to the audit log", async () => {
    await request(app).post("/api/v1/auth/login").send({ email: "admin@silwasa.test", password: "wrong-wrong-wrong" });
    await login(app, "admin@silwasa.test", PASSWORD);
    const dump = JSON.stringify(db.activities);
    expect(dump).not.toContain("wrong-wrong-wrong");
    expect(dump).not.toContain(PASSWORD);
    expect(db.activities.map((a) => a.action)).toEqual(expect.arrayContaining(["auth.login_failed", "auth.login"]));
  });
});

describe("sessions", () => {
  it("rejects /me without a cookie and accepts it with one", async () => {
    expect((await request(app).get("/api/v1/auth/me")).status).toBe(401);
    const { session } = await login(app, "admin@silwasa.test", PASSWORD);
    const me = await as(app, session).get("/api/v1/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data.user.roleKeys).toContain("SUPER_ADMIN");
  });

  it("rejects tampered and expired access tokens", async () => {
    const { session } = await login(app, "admin@silwasa.test", PASSWORD);
    const access = session.get("sw_access");

    const tampered = await request(app).get("/api/v1/auth/me").set("Cookie", `sw_access=${access.slice(0, -4)}AAAA`);
    expect(tampered.status).toBe(401);

    const user = [...db.users.values()][0]!;
    const sid = [...db.sessions.keys()][0]!;
    const expired = await new SignJWT({ sid })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuer("silwasa-api")
      .setAudience("silwasa-admin")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
    const res = await request(app).get("/api/v1/auth/me").set("Cookie", `sw_access=${expired}`);
    expect(res.status).toBe(401);
  });

  it("rotates refresh tokens and rejects reuse of the old one", async () => {
    const { session } = await login(app, "admin@silwasa.test", PASSWORD);
    const oldRefresh = session.get("sw_refresh");

    const first = await request(app).post("/api/v1/auth/refresh").set("Cookie", `sw_refresh=${oldRefresh}; sw_csrf=${session.csrf}`).set("x-csrf-token", session.csrf);
    expect(first.status).toBe(200);
    const rotated = parseSession(first.headers["set-cookie"] as unknown as string[]);
    expect(rotated.get("sw_refresh")).not.toBe(oldRefresh);
    expect(rotated.get("sw_access")).toBeTruthy();

    const replay = await request(app).post("/api/v1/auth/refresh").set("Cookie", `sw_refresh=${oldRefresh}; sw_csrf=${session.csrf}`).set("x-csrf-token", session.csrf);
    expect(replay.status).toBe(401);
  });

  it("logout invalidates the session server-side, not just the cookie", async () => {
    const { session } = await login(app, "admin@silwasa.test", PASSWORD);
    const out = await as(app, session).post("/api/v1/auth/logout");
    expect(out.status).toBe(200);
    const after = await request(app).get("/api/v1/auth/me").set("Cookie", `sw_access=${session.get("sw_access")}`);
    expect(after.status).toBe(401);
    const refresh = await request(app).post("/api/v1/auth/refresh").set("Cookie", `sw_refresh=${session.get("sw_refresh")}; sw_csrf=${session.csrf}`).set("x-csrf-token", session.csrf);
    expect(refresh.status).toBe(401);
  });

  it("stops honouring a session when the user is deactivated", async () => {
    const { session } = await login(app, "admin@silwasa.test", PASSWORD);
    [...db.users.values()][0]!.isActive = false;
    expect((await as(app, session).get("/api/v1/auth/me")).status).toBe(401);
  });
});

describe("csrf", () => {
  it("blocks state-changing admin calls without the csrf header", async () => {
    const { session } = await login(app, "admin@silwasa.test", PASSWORD);
    const res = await request(app)
      .post("/api/v1/admin/users")
      .set("Cookie", session.cookieHeader)
      .send({ email: "x@silwasa.test", name: "X", roleKeys: ["EDITOR"] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_INVALID");
  });

  it("blocks requests from origins that are not allow-listed", async () => {
    const { session } = await login(app, "admin@silwasa.test", PASSWORD);
    const res = await as(app, session)
      .post("/api/v1/admin/users")
      .set("Origin", "http://evil.example")
      .send({ email: "x@silwasa.test", name: "X", roleKeys: ["EDITOR"] });
    expect(res.status).toBe(403);
  });
});

describe("password reset", () => {
  it("responds identically for known and unknown emails", async () => {
    const known = await request(app).post("/api/v1/auth/forgot-password").send({ email: "admin@silwasa.test" });
    const unknown = await request(app).post("/api/v1/auth/forgot-password").send({ email: "ghost@silwasa.test" });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body.data).toEqual(unknown.body.data);
    expect(sentMail).toHaveLength(1);
  });

  it("resets the password once, signs out old sessions, and rejects weak passwords", async () => {
    const { session } = await login(app, "admin@silwasa.test", PASSWORD);
    await request(app).post("/api/v1/auth/forgot-password").send({ email: "admin@silwasa.test" });
    const token = new URL(sentMail[0]!.url).searchParams.get("token")!;

    const weak = await request(app).post("/api/v1/auth/reset-password").send({ token, password: "short" });
    expect(weak.status).toBe(422);

    const ok = await request(app).post("/api/v1/auth/reset-password").send({ token, password: "a-brand-new-passphrase" });
    expect(ok.status).toBe(200);

    expect((await request(app).get("/api/v1/auth/me").set("Cookie", session.cookieHeader)).status).toBe(401);
    expect((await login(app, "admin@silwasa.test", PASSWORD)).res.status).toBe(401);
    expect((await login(app, "admin@silwasa.test", "a-brand-new-passphrase")).res.status).toBe(200);

    const reuse = await request(app).post("/api/v1/auth/reset-password").send({ token, password: "another-new-passphrase" });
    expect(reuse.status).toBe(400);
  });

  it("changes password and keeps only the current session", async () => {
    const a = (await login(app, "admin@silwasa.test", PASSWORD)).session;
    const b = (await login(app, "admin@silwasa.test", PASSWORD)).session;
    const res = await as(app, a).post("/api/v1/auth/change-password").send({ currentPassword: PASSWORD, newPassword: "yet-another-passphrase" });
    expect(res.status).toBe(200);
    expect((await as(app, a).get("/api/v1/auth/me")).status).toBe(200);
    expect((await as(app, b).get("/api/v1/auth/me")).status).toBe(401);

    const wrong = await as(app, a).post("/api/v1/auth/change-password").send({ currentPassword: "not-the-password", newPassword: "yet-another-passphrase-2" });
    expect(wrong.status).toBe(400);
  });
});
