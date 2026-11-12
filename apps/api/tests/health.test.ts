import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("../src/config/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

import { createApp } from "../src/app";

const app = createApp();

describe("health endpoints", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("GET /api/v1/health returns liveness with a request id", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.headers["x-request-id"]).toBeTruthy();
    expect(res.body.meta.requestId).toBe(res.headers["x-request-id"]);
  });

  it("GET /api/v1/health/ready is 200 when the database responds", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await request(app).get("/api/v1/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe("up");
  });

  it("GET /api/v1/health/ready is 503 when the database is down", async () => {
    queryRaw.mockRejectedValue(new Error("connection refused"));
    const res = await request(app).get("/api/v1/health/ready");
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.database).toBe("down");
    expect(JSON.stringify(res.body)).not.toContain("connection refused");
  });
});

describe("platform behaviour", () => {
  it("returns a JSON 404 envelope for unknown routes", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("sets security headers and hides x-powered-by", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("only reflects allow-listed CORS origins", async () => {
    const allowed = await request(app).get("/api/v1/health").set("Origin", "http://localhost:3000");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    const denied = await request(app).get("/api/v1/health").set("Origin", "http://evil.example");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
