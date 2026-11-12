import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  SESSION_SECRET: "s".repeat(32),
  ENCRYPTION_KEY: "b".repeat(64),
};

describe("parseEnv", () => {
  it("applies defaults and derives helpers", () => {
    const env = parseEnv({ ...valid, CORS_ORIGINS: "http://a.com, http://b.com" });
    expect(env.PORT).toBe(4000);
    expect(env.corsOrigins).toEqual(["http://a.com", "http://b.com"]);
    expect(env.isProd).toBe(false);
  });

  it("rejects a short session secret and a malformed encryption key", () => {
    expect(() => parseEnv({ ...valid, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
    expect(() => parseEnv({ ...valid, ENCRYPTION_KEY: "nothex" })).toThrow(/ENCRYPTION_KEY/);
  });

  it("rejects a missing DATABASE_URL", () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });
});
