/** DTOs returned by the admin API, shared by the web app (and usable by the API). */
import type { Pagination } from "./index";

export type UserStatus = "active" | "inactive" | "deleted";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roleKeys: string[];
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface AdminRole {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

export interface AdminPermission {
  key: string;
  module: string;
  description: string | null;
}

export interface UserCounts {
  total: number;
  active: number;
  inactive: number;
  deleted: number;
}

export interface ActivityEntry {
  id: string;
  action: string;
  module: string;
  entityId: string | null;
  createdAt: string;
  actor: { name: string; email: string } | null;
}

export type ModuleKey = "pages" | "posts" | "enquiries";

export interface DashboardData {
  users: UserCounts | null;
  recentActivity: ActivityEntry[] | null;
  modules: Record<ModuleKey, { available: boolean; phase: number }>;
}

export interface CreateUserResult {
  user: AdminUser;
  /** Present only when no email provider delivered the invitation. Shown once to the creating admin. */
  inviteUrl?: string;
}

export interface PagedResult<T> {
  items: T[];
  pagination: Pagination;
}
