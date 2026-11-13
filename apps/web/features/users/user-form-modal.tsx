"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminUser } from "@silwasa/shared";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ErrorState, Spinner } from "@/components/ui/feedback";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useAdmin } from "@/features/admin-shell/auth-context";
import { ApiError, rolesApi, usersApi } from "@/lib/admin-api";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  name: z.string().trim().min(1, "Enter a name").max(100),
  roleKeys: z.array(z.string()).min(1, "Choose at least one role"),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function UserFormModal({
  open,
  user,
  onClose,
  onInvite,
}: {
  open: boolean;
  /** When provided the modal edits this user; otherwise it creates one. */
  user: AdminUser | null;
  onClose: () => void;
  onInvite: (info: { url: string; email: string }) => void;
}) {
  const { user: me } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const editing = user !== null;
  const isSelf = user?.id === me.id;

  const roles = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list, enabled: open });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", name: "", roleKeys: [], isActive: true },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        email: user?.email ?? "",
        name: user?.name ?? "",
        roleKeys: user?.roleKeys ?? [],
        isActive: user?.isActive ?? true,
      });
    }
  }, [open, user, form]);

  const save = useMutation({
    mutationFn: async (v: Values) => {
      if (user) {
        await usersApi.update(user.id, {
          name: v.name,
          ...(isSelf ? {} : { roleKeys: v.roleKeys, isActive: v.isActive }),
        });
        return null;
      }
      return usersApi.create({ email: v.email, name: v.name, roleKeys: v.roleKeys });
    },
    onSuccess: (result, v) => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "User updated" : "User created");
      onClose();
      if (result?.inviteUrl) onInvite({ url: result.inviteUrl, email: v.email });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "EMAIL_IN_USE") form.setError("email", { message: err.message });
      else if (err instanceof ApiError && err.code === "EMAIL_DELETED") form.setError("email", { message: err.message });
      else toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit user" : "Add user"}
      description={editing ? user.email : "They’ll get a one-time link to set their own password."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" loading={save.isPending}>
            {editing ? "Save changes" : "Create user"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <Field label="Full name" required error={form.formState.errors.name?.message}>
          {(p) => <Input {...p} autoComplete="off" {...form.register("name")} />}
        </Field>
        {!editing ? (
          <Field label="Email" required error={form.formState.errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="off" {...form.register("email")} />}
          </Field>
        ) : null}

        <fieldset disabled={isSelf}>
          <legend className="mb-1 text-sm font-medium text-slate-700">Roles</legend>
          {isSelf ? <p className="mb-2 text-xs text-slate-500">You can’t change your own roles or status.</p> : null}
          {roles.isLoading ? (
            <Spinner label="Loading roles" />
          ) : roles.error ? (
            <ErrorState message={roles.error.message} onRetry={() => void roles.refetch()} />
          ) : (
            <Controller
              control={form.control}
              name="roleKeys"
              render={({ field }) => (
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  {roles.data!.map((r) => (
                    <Checkbox
                      key={r.key}
                      label={r.name}
                      description={r.description ?? undefined}
                      checked={field.value.includes(r.key)}
                      onChange={(e) => field.onChange(e.target.checked ? [...field.value, r.key] : field.value.filter((k) => k !== r.key))}
                    />
                  ))}
                </div>
              )}
            />
          )}
          {form.formState.errors.roleKeys?.message ? (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {form.formState.errors.roleKeys.message}
            </p>
          ) : null}
        </fieldset>

        {editing ? <Checkbox label="Account is active" description="Inactive users cannot sign in." disabled={isSelf} {...form.register("isActive")} /> : null}
      </form>
    </Modal>
  );
}
