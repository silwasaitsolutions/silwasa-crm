/** Browser-side client for the admin API. Cookies carry auth; the CSRF token is echoed in a header. */

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

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let res = await rawFetch(path, method, body);
  if (res.status === 401 && !path.startsWith("/auth/")) {
    if (await refreshSession()) res = await rawFetch(path, method, body);
  }
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as
    | { success: boolean; data?: T; error?: { code: string; message: string; details?: unknown } }
    | null;
  if (!res.ok || !json?.success) {
    throw new ApiError(res.status, json?.error?.code ?? "UNKNOWN", json?.error?.message ?? "Request failed", json?.error?.details);
  }
  return json.data as T;
}

export const authApi = {
  login: (email: string, password: string) => api<{ user: AuthUser }>("/auth/login", "POST", { email, password }),
  me: () => api<{ user: AuthUser }>("/auth/me"),
  logout: () => api<{ loggedOut: boolean }>("/auth/logout", "POST"),
  forgotPassword: (email: string) => api<{ message: string }>("/auth/forgot-password", "POST", { email }),
  resetPassword: (token: string, password: string) =>
    api<{ message: string }>("/auth/reset-password", "POST", { token, password }),
};
