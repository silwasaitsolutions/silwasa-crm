# Progress

## Phase 1 — Foundation

### Completed
- pnpm monorepo, shared TS config, `.env.example`, `docker-compose.yml` (Postgres 16)
- `apps/api`: Express + TypeScript, env validation, pino logging, Helmet, CORS allowlist,
  request IDs, centralized error handling, `GET /api/v1/health` and `GET /api/v1/health/ready`
- Prisma schema: User, Role, Permission, UserRole, RolePermission, Session, PasswordResetToken, SiteSetting, ActivityLog
- `apps/web`: Next.js App Router + Tailwind 4, theme CSS variables, placeholder home, `/status` page
- `packages/shared`: API envelope types and role keys

### Verified in the build sandbox (actually executed)
- API: 9 Vitest tests pass (env validation, health liveness/readiness with DB mocked, 404 envelope, security headers, CORS allowlist)
- API: `tsc --noEmit`, ESLint, and `tsc` build all pass
- Web: `next build` succeeds; `tsc --noEmit` passes

### NOT yet verified (needs your machine)
- `prisma validate` / `prisma generate` / `prisma migrate dev` — the sandbox could not download Prisma engines
- API booting against a real PostgreSQL, and the `/status` page showing "connected"
- No migration folder exists yet: run `pnpm db:migrate` (name: `init`) and commit `apps/api/prisma/migrations/`

### Pending (Phase 1)
- Run the checks above locally and report any errors

### Known bugs
- None known. Prisma schema is unvalidated until you run the commands above.

### Database changes
- Initial schema defined (see `apps/api/prisma/schema.prisma`); migration to be generated locally.

### API changes
- `GET /api/v1/health`, `GET /api/v1/health/ready`

### Next
Phase 2 — authentication (Argon2id, sessions, refresh rotation, CSRF), RBAC seed, protected routes.
