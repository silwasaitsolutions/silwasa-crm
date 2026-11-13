import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-secondary">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export const inputClass =
  "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-secondary outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";
export const buttonClass =
  "w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-secondary transition hover:opacity-90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent";

export function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="mt-1 text-sm text-red-400">
      {message}
    </p>
  ) : null;
}
