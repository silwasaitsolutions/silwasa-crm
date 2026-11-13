import { Suspense } from "react";
import { Forbidden } from "@/features/admin-shell/forbidden";
import { UsersView } from "@/features/users/users-view";
import { can } from "@/lib/permissions";
import { getSessionUser } from "@/lib/server-auth";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  if (!can(await getSessionUser(), "users:read")) return <Forbidden />;
  return (
    <Suspense>
      <UsersView />
    </Suspense>
  );
}
