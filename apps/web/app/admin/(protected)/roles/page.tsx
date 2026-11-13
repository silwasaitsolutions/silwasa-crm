import { Forbidden } from "@/features/admin-shell/forbidden";
import { RolesView } from "@/features/roles/roles-view";
import { can } from "@/lib/permissions";
import { getSessionUser } from "@/lib/server-auth";

export const metadata = { title: "Roles & Permissions" };

export default async function RolesPage() {
  if (!can(await getSessionUser(), "roles:read")) return <Forbidden />;
  return <RolesView />;
}
