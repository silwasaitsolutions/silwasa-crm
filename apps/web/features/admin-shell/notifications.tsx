"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { describeActivity } from "@/lib/activity";
import { dashboardApi } from "@/lib/admin-api";
import { timeAgo } from "@/lib/format";
import { Spinner } from "@/components/ui/feedback";

/**
 * "Notifications" are the latest audit-log events (the only event stream that exists today).
 * The bell is only rendered for users who may read the activity log.
 */
export function Notifications() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.get,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Recent activity"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Bell className="size-5" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white shadow-lg">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Recent activity</p>
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-4"><Spinner /></div>
            ) : error ? (
              <p role="alert" className="p-4 text-sm text-red-600">Couldn’t load activity.</p>
            ) : (data?.recentActivity?.length ?? 0) === 0 ? (
              <p className="p-4 text-sm text-slate-500">Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data!.recentActivity!.map((a) => (
                  <li key={a.id} className="px-4 py-3 text-sm">
                    <p className="text-slate-800">{describeActivity(a)}</p>
                    <p className="text-xs text-slate-500">{timeAgo(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
