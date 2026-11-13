import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";
import { authGeneralLimiter, loginLimiter, passwordResetLimiter } from "../middleware/rate-limit";
import { asyncHandler } from "../utils/async-handler";

export const authRouter = Router();

authRouter.use(authGeneralLimiter());

authRouter.post("/login", loginLimiter(), asyncHandler(authController.login));
authRouter.post("/refresh", asyncHandler(authController.refresh));
authRouter.post("/forgot-password", passwordResetLimiter(), asyncHandler(authController.forgotPassword));
authRouter.post("/reset-password", passwordResetLimiter(), asyncHandler(authController.resetPassword));

// Logout works with only a refresh cookie (access token may have expired); identity is optional here.
authRouter.post("/logout", asyncHandler(async (req, res, next) => {
  if (req.cookies?.sw_access) {
    await new Promise<void>((resolve) => authenticate(req, res, () => resolve()));
  }
  return authController.logout(req, res).catch(next);
}));

authRouter.get("/me", authenticate, authController.me);
authRouter.post("/logout-all", authenticate, asyncHandler(authController.logoutAll));
authRouter.post("/change-password", authenticate, asyncHandler(authController.changePassword));
