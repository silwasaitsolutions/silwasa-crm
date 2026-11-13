"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, authApi } from "@/lib/admin-api";
import { AuthCard, FieldError, buttonClass, inputClass } from "./auth-card";

const schema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });
type Values = z.infer<typeof schema>;

export function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const isInvite = params.get("invite") === "1";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      await authApi.resetPassword(token, values.password);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    }
  }

  const title = isInvite ? "Set your password" : "Choose a new password";
  if (!token) {
    return (
      <AuthCard title={title}>
        <p role="alert" className="text-sm text-red-400">This link is missing its token. Request a new one.</p>
        <p className="mt-4 text-center text-sm"><Link href="/admin/forgot-password" className="text-accent hover:underline">Request a reset link</Link></p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={title} subtitle="Use at least 12 characters. A passphrase works well.">
      {done ? (
        <p role="status" className="text-sm text-secondary">
          Password saved. <Link href="/admin/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm">New password</label>
            <input id="password" type="password" autoComplete="new-password" className={inputClass} {...register("password")} />
            <FieldError message={formState.errors.password?.message} />
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1 block text-sm">Confirm password</label>
            <input id="confirm" type="password" autoComplete="new-password" className={inputClass} {...register("confirm")} />
            <FieldError message={formState.errors.confirm?.message} />
          </div>
          <FieldError message={error ?? undefined} />
          <button type="submit" disabled={formState.isSubmitting} className={buttonClass}>
            {formState.isSubmitting ? "Saving…" : "Save password"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
