"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useAdmin } from "@/features/admin-shell/auth-context";
import { ApiError, authApi } from "@/lib/admin-api";
import { titleCase } from "@/lib/permissions";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(12, "Use at least 12 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords do not match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a different password" });
type Values = z.infer<typeof schema>;

export function AccountView() {
  const { user } = useAdmin();
  const toast = useToast();
  const router = useRouter();
  const [confirmAll, setConfirmAll] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  const change = useMutation({
    mutationFn: (v: Values) => authApi.changePassword(v.currentPassword, v.newPassword),
    onSuccess: () => {
      toast.success("Password changed. Other devices were signed out.");
      form.reset();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "INVALID_CURRENT_PASSWORD") form.setError("currentPassword", { message: err.message });
      else if (err instanceof ApiError && err.status === 400) form.setError("newPassword", { message: err.message });
      else toast.error(err.message);
    },
  });

  const signOutAll = useMutation({
    mutationFn: authApi.logoutAll,
    onSettled: () => {
      router.replace("/admin/login");
      router.refresh();
    },
  });

  return (
    <>
      <PageHeader title="My account" description="Your profile and sign-in security." />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader title="Profile" />
          <dl className="grid gap-4 p-5 text-sm sm:grid-cols-3">
            <div><dt className="text-slate-500">Name</dt><dd className="mt-0.5 font-medium text-slate-900">{user.name}</dd></div>
            <div><dt className="text-slate-500">Email</dt><dd className="mt-0.5 font-medium text-slate-900 break-all">{user.email}</dd></div>
            <div><dt className="text-slate-500">Roles</dt><dd className="mt-0.5 font-medium text-slate-900">{user.roleKeys.map(titleCase).join(", ")}</dd></div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Change password" description="Use at least 12 characters. A passphrase works well." />
          <form onSubmit={form.handleSubmit((v) => change.mutate(v))} className="space-y-4 p-5" noValidate>
            <Field label="Current password" required error={form.formState.errors.currentPassword?.message}>
              {(p) => <Input {...p} type="password" autoComplete="current-password" {...form.register("currentPassword")} />}
            </Field>
            <Field label="New password" required error={form.formState.errors.newPassword?.message}>
              {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register("newPassword")} />}
            </Field>
            <Field label="Confirm new password" required error={form.formState.errors.confirm?.message}>
              {(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register("confirm")} />}
            </Field>
            <Button type="submit" loading={change.isPending}>Update password</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Sessions" description="Sign out everywhere if you lost a device or suspect someone else has access." />
          <div className="p-5">
            <Button variant="danger" onClick={() => setConfirmAll(true)}>Sign out of all devices</Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmAll}
        title="Sign out of all devices?"
        description="Every session, including this one, will end and you’ll need to sign in again."
        confirmLabel="Sign out everywhere"
        loading={signOutAll.isPending}
        onConfirm={() => signOutAll.mutate()}
        onCancel={() => setConfirmAll(false)}
      />
    </>
  );
}
