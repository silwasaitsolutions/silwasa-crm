"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminRole } from "@silwasa/shared";
import { Info, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useAdmin } from "@/features/admin-shell/auth-context";
import { rolesApi } from "@/lib/admin-api";
import { cn } from "@/lib/cn";
import { PermissionMatrix } from "./permission-matrix";
import { RoleFormModal } from "./role-form-modal";

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((k) => b.includes(k));

export function RolesView() {
  const { can } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const canManage = can("roles:manage");

  const roles = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const catalog = useQuery({ queryKey: ["permissions"], queryFn: rolesApi.permissions });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const selected = useMemo(() => roles.data?.find((r) => r.id === selectedId) ?? null, [roles.data, selectedId]);
  const dirty = selected !== null && !sameSet(draft, selected.permissions);

  // Select the first role once loaded, and re-sync the draft whenever the saved role changes.
  useEffect(() => {
    if (!roles.data?.length) return;
    if (!selectedId || !roles.data.some((r) => r.id === selectedId)) setSelectedId(roles.data[0]!.id);
  }, [roles.data, selectedId]);

  useEffect(() => {
    if (selected) setDraft(selected.permissions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.permissions.join("|")]);

  // Warn before leaving the page with unsaved permission changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function selectRole(role: AdminRole) {
    if (role.id === selectedId) return;
    if (dirty) setPendingId(role.id);
    else setSelectedId(role.id);
  }

  const save = useMutation({
    mutationFn: () => rolesApi.setPermissions(selected!.id, draft),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Permissions saved. They apply immediately.");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => rolesApi.remove(selected!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["roles"] });
      setSelectedId(null);
      setDeleteOpen(false);
      toast.success("Role deleted");
    },
    onError: (e) => {
      setDeleteOpen(false);
      toast.error(e.message);
    },
  });

  const isSuperAdmin = selected?.key === "SUPER_ADMIN";
  const readOnly = !canManage || isSuperAdmin;
  const deleteBlockedReason = !selected ? "" : selected.isSystem ? "System roles can’t be deleted" : selected.userCount > 0 ? "Reassign this role’s users first" : "";

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Control what each role can see and do. Changes apply to users immediately."
        actions={canManage ? <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" aria-hidden /> Create role</Button> : null}
      />

      {roles.error || catalog.error ? (
        <Card><ErrorState message={(roles.error ?? catalog.error)!.message} onRetry={() => { void roles.refetch(); void catalog.refetch(); }} /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <Card className="self-start">
            <CardHeader title="Roles" />
            {roles.isLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : roles.data!.length === 0 ? (
              <EmptyState title="No roles" />
            ) : (
              <ul className="p-2">
                {roles.data!.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => selectRole(r)}
                      aria-current={r.id === selectedId ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-primary",
                        r.id === selectedId ? "bg-primary/10" : "hover:bg-slate-50",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">{r.name}</span>
                        <span className="block text-xs text-slate-500">{r.userCount} user{r.userCount === 1 ? "" : "s"} · {r.key === "SUPER_ADMIN" ? "all" : r.permissions.length} permissions</span>
                      </span>
                      {r.isSystem ? <Badge>System</Badge> : <Badge tone="brand">Custom</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            {roles.isLoading || catalog.isLoading || !selected ? (
              <div className="space-y-3 p-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <>
                <CardHeader
                  title={selected.name}
                  description={selected.description ?? `Key: ${selected.key}`}
                  action={
                    canManage ? (
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                          <Pencil className="size-4" aria-hidden /> Edit
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(true)} disabled={Boolean(deleteBlockedReason)} title={deleteBlockedReason || undefined}>
                          <Trash2 className="size-4" aria-hidden /> Delete
                        </Button>
                      </div>
                    ) : null
                  }
                />
                <div className="space-y-4 p-5">
                  {isSuperAdmin ? (
                    <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                      The Super Admin role always has every permission and can’t be edited.
                    </p>
                  ) : !canManage ? (
                    <p className="flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                      You have read-only access. Only users with the “roles:manage” permission can change roles.
                    </p>
                  ) : null}

                  <PermissionMatrix
                    permissions={catalog.data!}
                    value={isSuperAdmin ? catalog.data!.map((p) => p.key) : draft}
                    onChange={setDraft}
                    readOnly={readOnly}
                  />

                  {!readOnly ? (
                    <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-between gap-3 rounded-b-xl border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur">
                      <p className="text-sm text-slate-500" aria-live="polite">{dirty ? "You have unsaved changes" : "All changes saved"}</p>
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setDraft(selected.permissions)} disabled={!dirty || save.isPending}>Discard</Button>
                        <Button onClick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>Save permissions</Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <RoleFormModal open={createOpen} role={null} onClose={() => setCreateOpen(false)} onCreated={setSelectedId} />
      <RoleFormModal open={editOpen} role={selected} onClose={() => setEditOpen(false)} />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this role?"
        description={<>The “{selected?.name}” role will be removed permanently. This can’t be undone.</>}
        confirmLabel="Delete role"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />
      <ConfirmDialog
        open={pendingId !== null}
        title="Discard unsaved changes?"
        description="You changed this role’s permissions but haven’t saved them. Switching roles will discard those changes."
        confirmLabel="Discard changes"
        onConfirm={() => { setSelectedId(pendingId); setPendingId(null); }}
        onCancel={() => setPendingId(null)}
      />
    </>
  );
}
