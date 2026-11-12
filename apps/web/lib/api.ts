const API_URL = process.env.API_URL ?? "http://localhost:4000";

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: { requestId?: string };
}

export async function apiGet<T>(path: string): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${API_URL}/api/v1${path}`, { cache: "no-store" });
  return (await res.json()) as ApiEnvelope<T>;
}
