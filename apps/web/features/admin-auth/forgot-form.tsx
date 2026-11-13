"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, authApi } from "@/lib/admin-api";
import { AuthCard, FieldError, buttonClass, inputClass } from "./auth-card";

const schema = z.object({ email: z.string().trim().email("Enter a valid email") });

export function ForgotForm() {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  async function onSubmit({ email }: z.infer<typeof schema>) {
    setError(null);
    try {
      setDone((await authApi.forgotPassword(email)).message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <AuthCard title="Reset your password" subtitle="We will email you a link if the account exists.">
      {done ? (
        <p role="status" className="text-sm text-secondary">{done}</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm">Email</label>
            <input id="email" type="email" autoComplete="username" className={inputClass} {...register("email")} />
            <FieldError message={formState.errors.email?.message} />
          </div>
          <FieldError message={error ?? undefined} />
          <button type="submit" disabled={formState.isSubmitting} className={buttonClass}>
            {formState.isSubmitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link href="/admin/login" className="text-accent hover:underline">Back to sign in</Link>
      </p>
    </AuthCard>
  );
}
