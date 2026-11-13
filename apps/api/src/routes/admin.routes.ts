import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller";
import { rolesController } from "../controllers/roles.controller";
import { usersController } from "../controllers/users.controller";
import { authenticate } from "../middleware/authenticate";
import { requireAnyPermission, requirePermission } from "../middleware/require-permission";
import { asyncHandler } from "../utils/async-handler";

export const adminRouter = Router();

// Every admin endpoint requires authentication; each route adds its own permission check.
adminRouter.use(authenticate);

// Permission-filtered overview; any signed-in admin may call it.
adminRouter.get("/dashboard", asyncHandler(dashboardController.get));

adminRouter.get("/users", requirePermission("users:read"), asyncHandler(usersController.list));
adminRouter.post("/users", requirePermission("users:create"), asyncHandler(usersController.create));
adminRouter.get("/users/:id", requirePermission("users:read"), asyncHandler(usersController.get));
adminRouter.put("/users/:id", requirePermission("users:update"), asyncHandler(usersController.update));
adminRouter.delete("/users/:id", requirePermission("users:delete"), asyncHandler(usersController.remove));

adminRouter.post("/users/:id/restore", requirePermission("users:update"), asyncHandler(usersController.restore));

// User managers need the role list to assign roles, so users:read is enough to read it.
adminRouter.get("/roles", requireAnyPermission("roles:read", "users:read"), asyncHandler(usersController.listRoles));
adminRouter.post("/roles", requirePermission("roles:manage"), asyncHandler(rolesController.create));
adminRouter.put("/roles/:id", requirePermission("roles:manage"), asyncHandler(rolesController.update));
adminRouter.delete("/roles/:id", requirePermission("roles:manage"), asyncHandler(rolesController.remove));
adminRouter.get("/permissions", requirePermission("roles:read"), asyncHandler(usersController.listPermissions));
adminRouter.put(
  "/roles/:id/permissions",
  requirePermission("roles:manage"),
  asyncHandler(usersController.setRolePermissions),
);
