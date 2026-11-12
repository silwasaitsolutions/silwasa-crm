import type { Request, Response } from "express";
import { healthService } from "../services/health.service";
import { ok } from "../utils/api-response";

export const healthController = {
  liveness(_req: Request, res: Response) {
    ok(res, healthService.liveness());
  },
  async readiness(req: Request, res: Response) {
    const result = await healthService.readiness();
    res.status(result.status === "ok" ? 200 : 503).json({
      success: result.status === "ok",
      data: result,
      meta: { requestId: req.id },
    });
  },
};
