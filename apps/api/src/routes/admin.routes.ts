import { Router } from "express";
import { usersController } from "../controllers/users.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

export const adminRouter = Router();

// Every admin endpoint requires authentication; each route adds its own permission check.
adminRouter.use(authenticate);

adminRouter.get("/users", requirePermission("users:read"), asyncHandler(usersController.list));
adminRouter.post("/users", requirePermission("users:create"), asyncHandler(usersController.create));
adminRouter.get("/users/:id", requirePermission("users:read"), asyncHandler(usersController.get));
adminRouter.put("/users/:id", requirePermission("users:update"), asyncHandler(usersController.update));
adminRouter.delete("/users/:id", requirePermission("users:delete"), asyncHandler(usersController.remove));

adminRouter.get("/roles", requirePermission("roles:read"), asyncHandler(usersController.listRoles));
adminRouter.get("/permissions", requirePermission("roles:read"), asyncHandler(usersController.listPermissions));
adminRouter.put(
  "/roles/:id/permissions",
  requirePermission("roles:manage"),
  asyncHandler(usersController.setRolePermissions),
);
