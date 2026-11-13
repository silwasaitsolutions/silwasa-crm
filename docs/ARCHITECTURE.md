# Architecture (Phase 1)

## Layout
Monorepo with pnpm workspaces: `apps/web` (Next.js), `apps/api` (Express), `packages/shared`.
The API is a separate deployable; the web app talks to it over REST (`/api/v1`).

## API layering
`routes → controllers → services → repositories (Prisma)`. Controllers only translate HTTP;
services hold business rules; repositories are the only code that touches Prisma (added from Phase 2).
Integrations (email, storage) live behind interfaces in `src/integrations/`.

## Conventions
- Response envelope: `{ success, data, meta: { requestId, pagination? } }`; errors `{ success:false, error:{code,message,details?}, meta }`.
- Errors: `AppError` for expected failures, `ZodError` -> 422, everything else -> 500 with no internals in production.
- Every request gets an `x-request-id` (client value accepted only if it matches a safe pattern).
- Env is validated with Zod at startup; the process refuses to boot on bad config.
- Logs are structured (pino) with cookies/authorization/passwords redacted.

## Decisions
| Decision | Why |
|---|---|
| Prisma 6 (classic client) | Stable, mature migrations; revisit Prisma 7 later. |
| TypeScript 5.9 | typescript-eslint does not yet support TS 7. |
| API compiled as CommonJS (`Node16` resolution) | No `.js` import suffixes; simplest for Render/Railway. |
| Refresh-token sessions stored hashed in `Session` | Allows revocation and rotation (Phase 2). |
| `SiteSetting` key/value JSONB | Used only for genuinely heterogeneous settings. |
| Phase 1 schema = identity, RBAC, sessions, settings, audit | Later phases add tables through new migrations. |
| Tailwind 4 with CSS custom properties | Theme colors are variables so Phase 4 can override them at runtime. |

## Authentication & authorization (Phase 2)
- **Passwords:** Argon2id (`@node-rs/argon2`, 19 MiB / 2 iterations / 1 lane). Policy: 12-128 chars, must not contain the account email.
- **Sessions:** a `Session` row per login. The browser holds a 15-minute signed JWT (`sw_access`, HttpOnly) and an opaque
  256-bit refresh token (`sw_refresh`, HttpOnly, path-scoped to `/api/v1/auth`). Only the SHA-256 of the refresh token is stored.
  Refresh is a compare-and-swap rotation, so a replayed old token is rejected.
- **Every request re-checks the database:** `authenticate` verifies the JWT, then loads the session and user. Revoking a session,
  deactivating a user or changing role permissions therefore takes effect immediately, not at token expiry.
- **RBAC:** permission keys (`pages:publish`, ...) live in `src/rbac/catalog.ts`. `requirePermission(...)` runs on each admin route.
  SUPER_ADMIN passes every check. Default roles are seeded once; later edits in the UI are never overwritten by re-seeding.
- **CSRF:** SameSite=Lax cookies + Origin allowlist + double-submit token (`x-csrf-token`) on `/auth` and `/admin` writes.
- **Same-origin cookies:** the web app rewrites `/api/v1/*` to the Express API, so cookies are first-party in production
  (Vercel + Render) with no cross-site cookie configuration.
- **Brute force:** per-IP rate limits on login and reset endpoints, plus per-account lockout (5 failures, 15 minutes).
- **Audit:** `ActivityLog` entries for login/logout/failures/lockouts, password events and user/role changes. Keys that look like
  secrets are redacted before storage.
- **Invitations:** a new user gets an unusable password and a 72-hour one-time link. Until Phase 9 adds email providers the link is
  returned to the creating Super Admin and (in development) printed in the API log.

## Known limitations (Phase 2)
- Refresh-token *reuse detection* (revoking the whole session family when an old token is replayed) is not implemented; a replayed
  token is simply rejected.
- Optional two-factor authentication is not implemented yet (the schema has the columns); planned with the security pass in Phase 11.
- No email is sent yet (Phase 9).
