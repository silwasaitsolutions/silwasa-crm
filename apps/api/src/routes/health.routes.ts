import { Router } from "express";
import { healthController } from "../controllers/health.controller";
import { asyncHandler } from "../utils/async-handler";

export const healthRouter = Router();

healthRouter.get("/", healthController.liveness);
healthRouter.get("/ready", asyncHandler(healthController.readiness));
