"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { ApiError } from "@/lib/admin-api";
import { AdminProvider, useAdmin, type AdminSessionUser } from "./auth-context";
import { Breadcrumbs } from "./breadcrumbs";
import { Notifications } from "./notifications";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";

const COLLAPSE_KEY = "sw_sidebar_collapsed"; // UI preference only; never auth data.

function Frame({ children }: { children: ReactNode }) {
  const { can } = useAdmin();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <a href="#main" className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:absolute focus:left-2 focus:top-2">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggle} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>
          {can("activity:read") ? <Notifications /> : null}
          <UserMenu />
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminShell({ user, children }: { user: AdminSessionUser; children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            // Don't retry auth/permission/validation failures; do retry transient ones once.
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AdminProvider user={user}>
          <Frame>{children}</Frame>
        </AdminProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
