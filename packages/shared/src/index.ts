/** Shape of every successful API response. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: { requestId?: string; pagination?: Pagination };
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
  meta: { requestId?: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const ROLE_KEYS = ["SUPER_ADMIN", "ADMIN", "EDITOR", "SEO_MANAGER"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];
