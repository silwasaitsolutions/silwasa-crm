import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin-shell/admin-shell";
import { safeNext } from "@/lib/safe-next";
import { getSessionUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    const path = safeNext((await headers()).get("x-pathname"));
    redirect(`/admin/login?next=${encodeURIComponent(path)}`);
  }
  return <AdminShell user={user}>{children}</AdminShell>;
}
