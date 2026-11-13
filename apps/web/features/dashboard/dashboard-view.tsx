"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Inbox, Newspaper, ShieldCheck, UserCog, UserPlus, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { useAdmin } from "@/features/admin-shell/auth-context";
import { describeActivity } from "@/lib/activity";
import { dashboardApi } from "@/lib/admin-api";
import { formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";

function StatCard({ label, icon: Icon, children, href }: { label: string; icon: LucideIcon; children: ReactNode; href?: string }) {
  const body = (
    <Card className={cn("h-full p-5", href && "transition hover:border-primary/40 hover:shadow")}>
      <div className="flex items-center justify-between text-slate-500">
        <p className="text-sm font-medium">{label}</p>
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
      {body}
    </Link>
  ) : (
    body
  );
}

function Unavailable({ phase }: { phase: number }) {
  return (
    <>
      <p className="text-sm font-medium text-slate-500">Not available yet</p>
      <p className="mt-1 text-xs text-slate-400">Arrives in Phase {phase}</p>
    </>
  );
}

function QuickAction({ href, icon: Icon, label, hint }: { href?: string; icon: LucideIcon; label: string; hint: string }) {
  const inner = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-primary/40 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-primary">
      {inner}
    </Link>
  ) : (
    <div aria-disabled="true" className="flex cursor-not-allowed items-center gap-3 rounded-lg border border-dashed border-slate-200 p-3 opacity-60">
      {inner}
    </div>
  );
}

export function DashboardView() {
  const { user, can } = useAdmin();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.get });

  return (
    <>
      <PageHeader title={`Welcome back, ${user.name.split(" ")[0]}`} description="Here’s what’s happening across your site." />

      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={() => void refetch()} />
        </Card>
      ) : (
        <>
          <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
            ) : (
              <>
                {data?.users ? (
                  <StatCard label="Users" icon={Users} href={can("users:read") ? "/admin/users" : undefined}>
                    <p className="text-3xl font-semibold text-slate-900">{data.users.total}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {data.users.active} active · {data.users.inactive} inactive · {data.users.deleted} deleted
                    </p>
                  </StatCard>
                ) : null}
                <StatCard label="Pages" icon={FileText}>
                  <Unavailable phase={data?.modules.pages.phase ?? 5} />
                </StatCard>
                <StatCard label="Blog posts" icon={Newspaper}>
                  <Unavailable phase={data?.modules.posts.phase ?? 7} />
                </StatCard>
                <StatCard label="Enquiries" icon={Inbox}>
                  <Unavailable phase={data?.modules.enquiries.phase ?? 9} />
                </StatCard>
              </>
            )}
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {data?.recentActivity !== null ? (
              <Card className="lg:col-span-2">
                <CardHeader title="Recent activity" description="Latest actions recorded in the audit log" />
                {isLoading ? (
                  <div className="space-y-3 p-5">
                    {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}
                  </div>
                ) : (data?.recentActivity?.length ?? 0) === 0 ? (
                  <EmptyState title="No activity yet" description="Actions like sign-ins and user changes will appear here." />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {data!.recentActivity!.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                        <span className="text-slate-800">{describeActivity(a)}</span>
                        <time dateTime={a.createdAt} title={formatDateTime(a.createdAt)} className="shrink-0 text-xs text-slate-500">
                          {timeAgo(a.createdAt)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ) : null}

            <Card className={data?.recentActivity === null ? "lg:col-span-3" : undefined}>
              <CardHeader title="Quick actions" />
              <div className="grid gap-3 p-5">
                {can("users:create") ? <QuickAction href="/admin/users?new=1" icon={UserPlus} label="Add a user" hint="Invite a team member" /> : null}
                {can("roles:read") ? <QuickAction href="/admin/roles" icon={ShieldCheck} label="Manage roles" hint="Edit permissions" /> : null}
                <QuickAction href="/admin/account" icon={UserCog} label="Account security" hint="Change your password" />
                <QuickAction icon={FileText} label="Create a page" hint="Available in Phase 5" />
                <QuickAction icon={Newspaper} label="Write a post" hint="Available in Phase 7" />
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
