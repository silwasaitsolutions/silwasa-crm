import request from "supertest";

export interface Session {
  cookies: string[];
  csrf: string;
  cookieHeader: string;
  get(name: string): string;
}

export function parseSession(setCookie: string[] | undefined): Session {
  const pairs = (setCookie ?? []).map((c) => c.split(";")[0]!);
  const get = (name: string) => pairs.find((p) => p.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
  return { cookies: pairs, csrf: get("sw_csrf"), cookieHeader: pairs.join("; "), get };
}

export async function login(app: Parameters<typeof request>[0], email: string, password: string) {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  return { res, session: parseSession(res.headers["set-cookie"] as unknown as string[]) };
}

/** Set DEBUG_HTTP=1 to print every non-2xx response (status, code, message) while running tests. */
const trace = <T extends { on: (e: "response", cb: (r: { status: number; req: { method: string; path: string }; body: unknown }) => void) => unknown }>(t: T): T => {
  if (process.env.DEBUG_HTTP) {
    t.on("response", (r) => {
      if (r.status >= 300) console.log(`[http] ${r.req.method} ${r.req.path} -> ${r.status}`, JSON.stringify((r.body as { error?: unknown })?.error ?? r.body));
    });
  }
  return t;
};

/** Builds an authenticated request helper that sends cookies and the CSRF header. */
export const as = (app: Parameters<typeof request>[0], s: Session) => ({
  get: (url: string) => trace(request(app).get(url).set("Cookie", s.cookieHeader)),
  post: (url: string) => trace(request(app).post(url).set("Cookie", s.cookieHeader).set("x-csrf-token", s.csrf)),
  put: (url: string) => trace(request(app).put(url).set("Cookie", s.cookieHeader).set("x-csrf-token", s.csrf)),
  del: (url: string) => trace(request(app).delete(url).set("Cookie", s.cookieHeader).set("x-csrf-token", s.csrf)),
});
