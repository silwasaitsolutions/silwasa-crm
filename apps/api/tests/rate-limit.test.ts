import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLimiter } from "../src/middleware/rate-limit";

describe("rate limiter", () => {
  it("returns 429 with the standard error envelope once the limit is exceeded", async () => {
    const app = express();
    app.post("/login", createLimiter({ windowMs: 60_000, limit: 3 }), (_req, res) => {
      res.json({ ok: true });
    });

    for (let i = 0; i < 3; i++) expect((await request(app).post("/login")).status).toBe(200);
    const blocked = await request(app).post("/login");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });
});
