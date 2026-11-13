import type { Request, Response } from "express";
import { dashboardService } from "../services/dashboard.service";
import { ok } from "../utils/api-response";

export const dashboardController = {
  async get(req: Request, res: Response) {
    ok(res, await dashboardService.get(req.auth!.user));
  },
};
