import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  roleKeys: string[];
  permissions: string[];
}

/** Verifies the session with the API on the server. Returns null when not authenticated. */
export const getSessionUser = cache(async function getSessionUser(): Promise<SessionUser | null> {
  const access = (await cookies()).get("sw_access")?.value;
  if (!access) return null;
  try {
    const res = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/api/v1/auth/me`, {
      headers: { cookie: `sw_access=${access}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { user?: SessionUser } };
    return json.data?.user ?? null;
  } catch {
    return null;
  }
});
