"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, authApi, refreshSession } from "@/lib/admin-api";
import { safeNext } from "@/lib/safe-next";
import { AuthCard, FieldError, buttonClass, inputClass } from "./auth-card";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  // If the access cookie expired but the refresh cookie is still valid, continue silently.
  useEffect(() => {
    refreshSession().then((ok) => (ok ? router.replace(next) : setChecking(false)));
  }, [router, next]);

  async function onSubmit(values: Values) {
    setError(null);
    try {
      await authApi.login(values.email, values.password);
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    }
  }

  if (checking) return <AuthCard title="Silwasa admin" subtitle="Checking your session…"><span /></AuthCard>;

  return (
    <AuthCard title="Sign in" subtitle="Silwasa CMS administration">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm">Email</label>
          <input id="email" type="email" autoComplete="username" className={inputClass} {...register("email")} />
          <FieldError message={formState.errors.email?.message} />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm">Password</label>
          <input id="password" type="password" autoComplete="current-password" className={inputClass} {...register("password")} />
          <FieldError message={formState.errors.password?.message} />
        </div>
        <FieldError message={error ?? undefined} />
        <button type="submit" disabled={formState.isSubmitting} className={buttonClass}>
          {formState.isSubmitting ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm">
          <Link href="/admin/forgot-password" className="text-accent hover:underline">Forgot your password?</Link>
        </p>
      </form>
    </AuthCard>
  );
}
