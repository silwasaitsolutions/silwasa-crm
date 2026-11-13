"use client";

import { LogOut, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { authApi } from "@/lib/admin-api";
import { initials } from "@/lib/format";
import { titleCase } from "@/lib/permissions";
import { useAdmin } from "./auth-context";

export function UserMenu() {
  const { user } = useAdmin();
  const router = useRouter();

  async function signOut() {
    try {
      await authApi.logout();
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-sm font-medium text-slate-900">{user.name}</p>
        <p className="text-xs text-slate-500">{user.roleKeys.map(titleCase).join(", ")}</p>
      </div>
      <DropdownMenu
        label="Account menu"
        trigger={<span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-white">{initials(user.name)}</span>}
        items={[
          { label: "My account", icon: <UserCog className="size-4" aria-hidden />, onSelect: () => router.push("/admin/account") },
          { label: "Sign out", icon: <LogOut className="size-4" aria-hidden />, tone: "danger", onSelect: signOut },
        ]}
      />
    </div>
  );
}
