import { Router } from "express";
import { csrfProtection } from "../middleware/csrf";
import { adminRouter } from "./admin.routes";
import { authRouter } from "./auth.routes";
import { healthRouter } from "./health.routes";

export const apiV1Router = Router();

apiV1Router.use("/health", healthRouter);

// CSRF protection applies to cookie-authenticated areas only; public content endpoints have no session.
apiV1Router.use("/auth", csrfProtection, authRouter);
apiV1Router.use("/admin", csrfProtection, adminRouter);
// Phase 3+: pages, blogs, media, services, ... are mounted here.
