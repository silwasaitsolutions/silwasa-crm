import { SignOutButton } from "@/features/admin-auth/sign-out-button";
import { getSessionUser } from "@/lib/server-auth";

export const metadata = { title: "Dashboard" };

// Phase 2 placeholder. The full dashboard (sidebar, stats, tables) is built in Phase 3.
export default async function AdminHome() {
  const user = (await getSessionUser())!;
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold text-secondary">Welcome, {user.name}</h1>
      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex gap-2"><dt className="w-24">Email</dt><dd className="text-secondary">{user.email}</dd></div>
        <div className="flex gap-2"><dt className="w-24">Roles</dt><dd className="text-secondary">{user.roleKeys.join(", ")}</dd></div>
        <div className="flex gap-2"><dt className="w-24">Permissions</dt><dd className="text-secondary">{user.permissions.length}</dd></div>
      </dl>
      <div className="mt-8 max-w-48"><SignOutButton /></div>
    </main>
  );
}
