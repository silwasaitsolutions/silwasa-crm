import { Router } from "express";
import { healthRouter } from "./health.routes";

export const apiV1Router = Router();

apiV1Router.use("/health", healthRouter);
// Phase 2+: auth, admin, pages, blogs, ... are mounted here.
