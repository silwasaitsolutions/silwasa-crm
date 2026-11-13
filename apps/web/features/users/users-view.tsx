"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminUser, UserStatus } from "@silwasa/shared";
import { MoreHorizontal, Pencil, Plus, Power, RotateCcw, Search, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DropdownMenu, type MenuItem } from "@/components/ui/dropdown-menu";
import { Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import { useAdmin } from "@/features/admin-shell/auth-context";
import { rolesApi, usersApi } from "@/lib/admin-api";
import { formatDate, formatDateTime } from "@/lib/format";
import { InviteLinkDialog } from "./invite-link-dialog";
import { UserFormModal } from "./user-form-modal";
import { useDebounced } from "./use-debounced";

type ConfirmAction = { kind: "delete" | "deactivate"; user: AdminUser } | null;

function StatusBadge({ user }: { user: AdminUser }) {
  if (user.deletedAt) return <Badge tone="danger">Deleted</Badge>;
  return user.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="warning">Inactive</Badge>;
}

export function UsersView() {
  const { user: me, can } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearch = useDebounced(search.trim());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [invite, setInvite] = useState<{ url: string; email: string } | null>(null);

  // `?new=1` (dashboard quick action) opens the create dialog once, then cleans the URL.
  useEffect(() => {
    if (params.get("new") === "1" && can("users:create")) {
      setEditing(null);
      setFormOpen(true);
      router.replace("/admin/users");
    }
  }, [params, can, router]);

  const query = { page, pageSize, search: debouncedSearch || undefined, status: status || undefined, role: role || undefined };
  const users = useQuery({
    queryKey: ["users", query],
    queryFn: () => usersApi.list(query),
    placeholderData: keepPreviousData,
  });
  const roles = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["users"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const fail = (err: Error) => toast.error(err.message);

  const toggleActive = useMutation({
    mutationFn: (u: AdminUser) => usersApi.update(u.id, { isActive: !u.isActive }),
    onSuccess: (u) => {
      refresh();
      toast.success(u.isActive ? "User activated" : "User deactivated");
      setConfirm(null);
    },
    onError: (e) => {
      setConfirm(null);
      fail(e);
    },
  });
  const remove = useMutation({
    mutationFn: (u: AdminUser) => usersApi.remove(u.id),
    onSuccess: () => {
      refresh();
      toast.success("User deleted. You can restore them from the Deleted filter.");
      setConfirm(null);
    },
    onError: (e) => {
      setConfirm(null);
      fail(e);
    },
  });
  const restore = useMutation({
    mutationFn: (u: AdminUser) => usersApi.restore(u.id),
    onSuccess: () => {
      refresh();
      toast.success("User restored as inactive. Activate them when ready.");
    },
    onError: fail,
  });

  const canUpdate = can("users:update");
  const canDelete = can("users:delete");

  function actionsFor(u: AdminUser): MenuItem[] {
    const self = u.id === me.id;
    if (u.deletedAt) {
      return canUpdate ? [{ label: "Restore", icon: <RotateCcw className="size-4" aria-hidden />, onSelect: () => restore.mutate(u) }] : [];
    }
    const items: MenuItem[] = [];
    if (canUpdate) {
      items.push({ label: "Edit", icon: <Pencil className="size-4" aria-hidden />, onSelect: () => { setEditing(u); setFormOpen(true); } });
      items.push({
        label: u.isActive ? "Deactivate" : "Activate",
        icon: <Power className="size-4" aria-hidden />,
        disabled: self,
        disabledReason: "You can’t change your own status",
        onSelect: () => (u.isActive ? setConfirm({ kind: "deactivate", user: u }) : toggleActive.mutate(u)),
      });
    }
    if (canDelete) {
      items.push({ label: "Delete", tone: "danger", icon: <Trash2 className="size-4" aria-hidden />, disabled: self, disabledReason: "You can’t delete your own account", onSelect: () => setConfirm({ kind: "delete", user: u }) });
    }
    return items;
  }

  const columns: Column<AdminUser>[] = [
    {
      key: "user",
      header: "User",
      cell: (u) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">
            {u.name}
            {u.id === me.id ? <span className="ml-2 text-xs font-normal text-slate-500">(you)</span> : null}
          </p>
          <p className="truncate text-xs text-slate-500">{u.email}</p>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Roles",
      hideOnMobile: true,
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roleKeys.map((k) => (
            <Badge key={k} tone="brand">{roles.data?.find((r) => r.key === k)?.name ?? k}</Badge>
          ))}
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (u) => <StatusBadge user={u} /> },
    { key: "last", header: "Last sign-in", hideOnMobile: true, cell: (u) => <span className="text-xs text-slate-500">{formatDateTime(u.lastLoginAt)}</span> },
    { key: "created", header: "Created", hideOnMobile: true, cell: (u) => <span className="text-xs text-slate-500">{formatDate(u.createdAt)}</span> },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      className: "w-12 text-right",
      cell: (u) => {
        const items = actionsFor(u);
        return items.length ? (
          <DropdownMenu label={`Actions for ${u.name}`} trigger={<MoreHorizontal className="size-5" aria-hidden />} items={items} />
        ) : null;
      },
    },
  ];

  const filtersActive = Boolean(debouncedSearch || status || role);

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage who can sign in to the admin and what they can do."
        actions={
          can("users:create") ? (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="size-4" aria-hidden /> Add user
            </Button>
          ) : null
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              type="search"
              aria-label="Search users"
              placeholder="Search by name or email"
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value as UserStatus | ""); setPage(1); }} className="w-auto">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deleted">Deleted</option>
          </Select>
          <Select aria-label="Filter by role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="w-auto">
            <option value="">All roles</option>
            {roles.data?.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </Select>
          {filtersActive ? (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatus(""); setRole(""); setPage(1); }}>
              Clear filters
            </Button>
          ) : null}
        </div>

        <DataTable
          caption="Users"
          columns={columns}
          rows={users.data?.items}
          rowKey={(u) => u.id}
          isLoading={users.isLoading}
          error={users.error}
          onRetry={() => void users.refetch()}
          empty={{
            title: filtersActive ? "No users match your filters" : "No users yet",
            description: filtersActive ? "Try a different search or clear the filters." : "Add the first team member to get started.",
          }}
        />
        {users.data && !users.error ? (
          <Pagination pagination={users.data.pagination} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
        ) : null}
      </Card>

      <UserFormModal open={formOpen} user={editing} onClose={() => setFormOpen(false)} onInvite={setInvite} />
      <InviteLinkDialog url={invite?.url ?? null} email={invite?.email ?? ""} onClose={() => setInvite(null)} />

      <ConfirmDialog
        open={confirm?.kind === "delete"}
        title="Delete this user?"
        description={<>{confirm?.user.name} will lose access immediately and all their sessions will be signed out. You can restore the account later.</>}
        confirmLabel="Delete user"
        loading={remove.isPending}
        onConfirm={() => confirm && remove.mutate(confirm.user)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "deactivate"}
        title="Deactivate this user?"
        description={<>{confirm?.user.name} will be signed out and won’t be able to sign in until you activate them again.</>}
        confirmLabel="Deactivate"
        loading={toggleActive.isPending}
        onConfirm={() => confirm && toggleActive.mutate(confirm.user)}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
