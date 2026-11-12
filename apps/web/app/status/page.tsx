import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata = { title: "System status", robots: { index: false, follow: false } };

interface Liveness { status: string; uptimeSeconds: number }
interface Readiness { status: string; database: string }

async function safe<T>(path: string): Promise<{ ok: boolean; data?: T }> {
  try {
    const res = await apiGet<T>(path);
    return { ok: res.success, data: res.data };
  } catch {
    return { ok: false };
  }
}

export default async function StatusPage() {
  const [live, ready] = await Promise.all([safe<Liveness>("/health"), safe<Readiness>("/health/ready")]);
  const rows = [
    { name: "API", ok: live.ok, detail: live.ok ? `up ${live.data?.uptimeSeconds}s` : "unreachable" },
    { name: "Database", ok: ready.ok, detail: ready.ok ? "connected" : "not connected" },
  ];
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-secondary">System status</h1>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3">
            <span className="text-secondary">{r.name}</span>
            <span className={r.ok ? "text-accent" : "text-red-400"}>{r.detail}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
