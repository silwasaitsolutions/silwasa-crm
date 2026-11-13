"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { can as canUser } from "@/lib/permissions";

export interface AdminSessionUser {
  id: string;
  email: string;
  name: string;
  roleKeys: string[];
  permissions: string[];
}

interface AdminContextValue {
  user: AdminSessionUser;
  can: (permission: string) => boolean;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ user, children }: { user: AdminSessionUser; children: ReactNode }) {
  const value = useMemo(() => ({ user, can: (p: string) => canUser(user, p) }), [user]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}
