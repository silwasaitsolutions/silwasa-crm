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


## Phase 3 — Admin dashboard, Users & Roles UI

### Completed
- **Shell:** collapsible sidebar (desktop) + drawer (mobile), sticky header with breadcrumbs, activity "notifications", account menu, skip link; protected layout verifies the session on the server and permission-gates each page
- **Design system** (`apps/web/components/ui`): Button, form controls + Field, Badge, Card, Modal (native dialog), ConfirmDialog, DataTable (loading/empty/error), Pagination, Toasts, DropdownMenu, Skeleton/EmptyState/ErrorState
- **Dashboard:** real user counts and recent audit activity from `GET /admin/dashboard`; Pages/Posts/Enquiries are shown as "Not available yet" until Phases 5/7/9 (no fake numbers); quick actions respect permissions
- **Users:** search, status + role filters, pagination, create (invitation link), edit, activate/deactivate, soft delete, **restore**
- **Roles & Permissions:** role list, grouped permission matrix with unsaved-changes guard, create/edit/delete **custom** roles; Super Admin role read-only; read-only mode without `roles:manage`
- **My account:** change password, sign out of all devices
- **API additions:** `GET /admin/dashboard`, `POST /admin/users/:id/restore`, user list `status`/`role` filters, `POST/PUT/DELETE /admin/roles`, roles list readable with `users:read`
- **Behaviour change:** soft delete no longer rewrites the email (so restore keeps the real address). Creating a user with a deleted user's email returns `EMAIL_DELETED`. Restored users come back *inactive*.
- No schema change, so no migration and no new RLS statements.

### Verified in the build sandbox (actually executed)
- API: 55 Vitest tests pass; ESLint clean
- Web: 28 Vitest tests pass (utilities, DataTable/Pagination/PermissionMatrix/Sidebar components), ESLint, `tsc` and `next build` succeed

### NOT verified in the sandbox
- The UI has not been viewed in a real browser against a live API/database (sandbox cannot generate the Prisma client). Please click through Dashboard, Users, Roles and Account.
- Repository code for the new queries (status/role filters, restore, role CRUD, dashboard counts, recent activity) against real PostgreSQL. Run `pnpm typecheck` locally.

### Pending
- Pages/Posts/Enquiries stats (when those modules exist), Activity Logs screen (Phase 10), 2FA, email delivery

### Known limitations
- Users that were soft-deleted *before* this phase had their email rewritten to `deleted+<id>@invalid.local`; restoring them keeps that placeholder (there is no email-edit yet).
