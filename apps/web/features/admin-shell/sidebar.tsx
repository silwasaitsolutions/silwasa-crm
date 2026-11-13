"use client";

import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useAdmin } from "./auth-context";
import { NAV_GROUPS, UPCOMING, isActive } from "./nav-config";

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/admin" className="flex items-center gap-2 px-4 py-4 font-semibold text-white">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-black">S</span>
      {collapsed ? null : <span>Silwasa CMS</span>}
    </Link>
  );
}

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAdmin();

  return (
    <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-2 pb-4">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((i) => !i.permission || can(i.permission));
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            {collapsed ? null : <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">{group.label}</p>}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-accent",
                        active ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      <item.icon className="size-5 shrink-0" aria-hidden />
                      {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <div>
        {collapsed ? null : <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">Coming soon</p>}
        <ul className="space-y-0.5">
          {UPCOMING.map((item) => (
            <li key={item.label}>
              <span
                aria-disabled="true"
                title={`${item.label} — available in Phase ${item.phase}`}
                className={cn("flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/30", collapsed && "justify-center px-2")}
              >
                <item.icon className="size-5 shrink-0" aria-hidden />
                {collapsed ? (
                  <span className="sr-only">{item.label} (coming in Phase {item.phase})</span>
                ) : (
                  <>
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded bg-white/10 px-1.5 text-[10px]">Ph {item.phase}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/** Desktop sidebar (collapsible) and mobile drawer. */
export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <>
      <aside className={cn("hidden shrink-0 flex-col bg-[#151414] transition-[width] duration-200 lg:flex", collapsed ? "w-[68px]" : "w-64")}>
        <Brand collapsed={collapsed} />
        <NavList collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="m-2 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white"
        >
          {collapsed ? <ChevronsRight className="size-5" aria-hidden /> : <><ChevronsLeft className="size-5" aria-hidden /> Collapse</>}
        </button>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-900/50" onClick={onCloseMobile} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[#151414]">
            <div className="flex items-center justify-between pr-3">
              <Brand collapsed={false} />
              <button type="button" onClick={onCloseMobile} aria-label="Close navigation" className="rounded-md p-1.5 text-white/70 hover:bg-white/10">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <NavList collapsed={false} onNavigate={onCloseMobile} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
