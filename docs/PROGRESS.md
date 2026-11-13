# Progress

## Phase 1 — Foundation (verified locally by the project owner)
Monorepo, Express API with health/readiness, Next.js app with `/status`, Prisma schema + migration against Supabase PostgreSQL,
RLS enabled on application tables.

## Phase 2 — Authentication, sessions & RBAC

### Completed
- Argon2id password hashing, login/logout/logout-all/refresh/me, forgot/reset/change password
- Cookie sessions (HttpOnly access + refresh cookies), refresh rotation, server-side revocation, account lockout, rate limiting
- CSRF protection (Origin allowlist + double-submit token) on `/auth` and `/admin`
- RBAC: permission catalog, `authenticate` + `requirePermission` middleware, idempotent seed for permissions/roles + bootstrap Super Admin
- User management API (list/get/create-with-invitation/update/soft-delete) and role-permission editing, with self-lockout and last-Super-Admin guards
- Audit logging for auth and user/role changes (secret-like keys redacted)
- Web: `/admin/login`, `/admin/forgot-password`, `/admin/reset-password`, protected `/admin` (proxy gate + server-side session check), same-origin API proxy
- No schema change in this phase, so no new migration and no new RLS statements are needed.

### Verified in the build sandbox (actually executed)
- API: 44 Vitest tests pass (auth, sessions, CSRF, reset, RBAC, user management, rate limiting) using in-memory fakes; no database touched
- API: ESLint passes. Web: `tsc`, `next build` and 10 Vitest tests pass.

### NOT verified in the sandbox (run on your machine)
- `pnpm typecheck` for the API: the sandbox cannot generate the Prisma client, so the repository files and `prisma/seed.ts`
  were not type-checked against real Prisma types. Run `pnpm typecheck` and report any errors.
- Repository code against a real PostgreSQL (queries, transactions), the seed script, and the browser login flow end to end.

### Pending
- Two-factor authentication and refresh-token reuse detection (see docs/ARCHITECTURE.md)
- Email delivery of reset/invitation links (Phase 9)
- Users & Roles admin screens (Phase 3 dashboard)

### Known bugs
- None known.

### API changes
- See docs/API.md.

### Next
Phase 3: admin dashboard foundation (layout, sidebar, top bar, reusable tables/forms, stats, Users & Roles screens).
