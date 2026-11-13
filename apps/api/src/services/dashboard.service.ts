import { roleHasAll } from "../rbac/catalog";
import { activityRepository } from "../repositories/activity.repository";
import { userRepository } from "../repositories/user.repository";
import type { AuthUser } from "../types/auth";

const can = (user: AuthUser, permission: string) =>
  roleHasAll(user.roleKeys) || user.permissions.includes(permission);

/**
 * Dashboard data is real and permission-filtered. Modules that do not exist yet are reported as
 * unavailable instead of returning made-up numbers; they switch on as their phases ship.
 */
export const dashboardService = {
  async get(user: AuthUser) {
    const [users, recentActivity] = await Promise.all([
      can(user, "users:read") ? userRepository.counts() : null,
      can(user, "activity:read") ? activityRepository.listRecent(8) : null,
    ]);
    return {
      users,
      recentActivity,
      modules: {
        pages: { available: false, phase: 5 },
        posts: { available: false, phase: 7 },
        enquiries: { available: false, phase: 9 },
      },
    };
  },
};
