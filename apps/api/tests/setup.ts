// Deterministic env for tests; no real database is touched.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.SESSION_SECRET = "x".repeat(48);
process.env.ENCRYPTION_KEY = "a".repeat(64);
process.env.CORS_ORIGINS = "http://localhost:3000";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.API_URL = "http://localhost:4000";
process.env.ACCESS_TOKEN_TTL_MINUTES = "15";
process.env.REFRESH_TOKEN_TTL_DAYS = "7";
process.env.LOG_LEVEL = "silent";
delete process.env.COOKIE_DOMAIN;

// Swap every Prisma-backed repository for an in-memory fake. Tests never touch a real database.
import { vi } from "vitest";

vi.mock("../src/config/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock("../src/repositories/user.repository", async () => ({
  userRepository: (await import("./helpers/fake-db.js")).userRepository,
}));
vi.mock("../src/repositories/session.repository", async () => ({
  sessionRepository: (await import("./helpers/fake-db.js")).sessionRepository,
}));
vi.mock("../src/repositories/reset-token.repository", async () => ({
  resetTokenRepository: (await import("./helpers/fake-db.js")).resetTokenRepository,
}));
vi.mock("../src/repositories/role.repository", async () => ({
  roleRepository: (await import("./helpers/fake-db.js")).roleRepository,
}));
vi.mock("../src/repositories/activity.repository", async () => ({
  activityRepository: (await import("./helpers/fake-db.js")).activityRepository,
}));
vi.mock("../src/integrations/email/mailer", async () => {
  const { sentMail } = await import("./helpers/fake-db.js");
  return {
    mailer: {
      sendPasswordReset: async (to: { email: string }, url: string) => {
        sentMail.push({ kind: "reset", email: to.email, url });
        return false;
      },
      sendInvitation: async (to: { email: string }, url: string) => {
        sentMail.push({ kind: "invite", email: to.email, url });
        return false;
      },
    },
  };
});
