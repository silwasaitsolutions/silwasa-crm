/** Browser-side client for the admin API. Cookies carry auth; the CSRF token is echoed in a header. */

import type {
  AdminPermission,
  AdminRole,
  AdminUser,
  CreateUserResult,
  DashboardData,
  PagedResult,
  Pagination,
  UserStatus,
} from "@silwasa/shared";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleKeys: string[];
  permissions: string[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const readCookie = (name: string) =>
  typeof document === "undefined"
    ? ""
    : (document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.split("=")[1] ?? "");

let refreshing: Promise<boolean> | null = null;

async function rawFetch(path: string, method: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["x-csrf-token"] = readCookie("sw_csrf");
  return fetch(`/api/v1${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Attempts one silent session refresh; concurrent callers share a single request. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= rawFetch("/auth/refresh", "POST")
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: { pagination?: Pagination };
  error?: { code: string; message: string; details?: unknown };
}

async function send<T>(path: string, method: string, body?: unknown): Promise<Envelope<T> | null> {
  let res = await rawFetch(path, method, body);
  if (res.status === 401 && !path.startsWith("/auth/")) {
    if (await refreshSession()) res = await rawFetch(path, method, body);
  }
  if (res.status === 204) return null;
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !json?.success) {
    throw new ApiError(res.status, json?.error?.code ?? "UNKNOWN", json?.error?.message ?? "Request failed", json?.error?.details);
  }
  return json;
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const json = await send<T>(path, method, body);
  return (json?.data as T) ?? (undefined as T);
}

export async function apiPaged<T>(path: string): Promise<PagedResult<T>> {
  const json = await send<T[]>(path, "GET");
  return {
    items: json?.data ?? [],
    pagination: json?.meta?.pagination ?? { page: 1, pageSize: json?.data?.length ?? 0, total: json?.data?.length ?? 0, totalPages: 1 },
  };
}

export const authApi = {
  login: (email: string, password: string) => api<{ user: AuthUser }>("/auth/login", "POST", { email, password }),
  me: () => api<{ user: AuthUser }>("/auth/me"),
  logout: () => api<{ loggedOut: boolean }>("/auth/logout", "POST"),
  logoutAll: () => api<{ loggedOut: boolean }>("/auth/logout-all", "POST"),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ message: string }>("/auth/change-password", "POST", { currentPassword, newPassword }),
  forgotPassword: (email: string) => api<{ message: string }>("/auth/forgot-password", "POST", { email }),
  resetPassword: (token: string, password: string) =>
    api<{ message: string }>("/auth/reset-password", "POST", { token, password }),
};

export interface UserListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: UserStatus;
  role?: string;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  return sp.toString();
};

export const dashboardApi = { get: () => api<DashboardData>("/admin/dashboard") };

export const usersApi = {
  list: (q: UserListQuery) => apiPaged<AdminUser>(`/admin/users?${qs({ ...q })}`),
  create: (input: { email: string; name: string; roleKeys: string[] }) =>
    api<CreateUserResult>("/admin/users", "POST", input),
  update: (id: string, input: { name?: string; isActive?: boolean; roleKeys?: string[] }) =>
    api<AdminUser>(`/admin/users/${id}`, "PUT", input),
  remove: (id: string) => api<void>(`/admin/users/${id}`, "DELETE"),
  restore: (id: string) => api<AdminUser>(`/admin/users/${id}/restore`, "POST", {}),
};

export const rolesApi = {
  list: () => api<AdminRole[]>("/admin/roles"),
  permissions: () => api<AdminPermission[]>("/admin/permissions"),
  create: (input: { key: string; name: string; description?: string; permissions: string[] }) =>
    api<{ id: string; key: string }>("/admin/roles", "POST", input),
  update: (id: string, input: { name?: string; description?: string | null }) =>
    api<void>(`/admin/roles/${id}`, "PUT", input),
  remove: (id: string) => api<void>(`/admin/roles/${id}`, "DELETE"),
  setPermissions: (id: string, permissions: string[]) =>
    api<void>(`/admin/roles/${id}/permissions`, "PUT", { permissions }),
};
