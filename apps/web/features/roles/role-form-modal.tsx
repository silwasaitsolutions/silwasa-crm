"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminRole } from "@silwasa/shared";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ApiError, rolesApi } from "@/lib/admin-api";
import { PermissionMatrix } from "./permission-matrix";

const schema = z.object({
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,49}$/, "Use letters, numbers and underscores (2–50 characters, starting with a letter)"),
  name: z.string().trim().min(1, "Enter a name").max(100),
  description: z.string().trim().max(300, "Keep it under 300 characters"),
});
type Values = z.infer<typeof schema>;

/** Create a custom role, or (when `role` is given) edit its name and description. */
export function RoleFormModal({
  open,
  role,
  onClose,
  onCreated,
}: {
  open: boolean;
  role: AdminRole | null;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const editing = role !== null;
  const toast = useToast();
  const qc = useQueryClient();
  const [permissions, setPermissions] = useState<string[]>([]);
  const catalog = useQuery({ queryKey: ["permissions"], queryFn: rolesApi.permissions, enabled: open && !editing });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { key: "", name: "", description: "" } });

  useEffect(() => {
    if (open) {
      form.reset({ key: role?.key ?? "", name: role?.name ?? "", description: role?.description ?? "" });
      setPermissions([]);
    }
  }, [open, role, form]);

  const save = useMutation({
    mutationFn: async (v: Values) => {
      if (role) {
        await rolesApi.update(role.id, { name: v.name, description: v.description || null });
        return null;
      }
      return rolesApi.create({ key: v.key, name: v.name, description: v.description || undefined, permissions });
    },
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success(editing ? "Role updated" : "Role created");
      onClose();
      if (created) onCreated?.(created.id);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "ROLE_KEY_IN_USE") form.setError("key", { message: err.message });
      else toast.error(err.message);
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Edit role" : "Create role"}
      description={editing ? `Key: ${role.key} (can’t be changed)` : "Custom roles can be assigned to users and deleted when unused."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form="role-form" loading={save.isPending}>{editing ? "Save changes" : "Create role"}</Button>
        </>
      }
    >
      <form id="role-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={form.formState.errors.name?.message}>
            {(p) => <Input {...p} {...form.register("name")} />}
          </Field>
          {!editing ? (
            <Field label="Key" required hint="Stored in uppercase, e.g. CONTENT_REVIEWER" error={form.formState.errors.key?.message}>
              {(p) => <Input {...p} autoCapitalize="characters" {...form.register("key")} />}
            </Field>
          ) : null}
        </div>
        <Field label="Description" error={form.formState.errors.description?.message}>
          {(p) => <Textarea {...p} {...form.register("description")} />}
        </Field>
        {!editing ? (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Permissions</p>
            {catalog.isLoading ? <Spinner label="Loading permissions" /> : catalog.error ? (
              <p role="alert" className="text-sm text-red-600">{catalog.error.message}</p>
            ) : (
              <PermissionMatrix permissions={catalog.data!} value={permissions} onChange={setPermissions} />
            )}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
