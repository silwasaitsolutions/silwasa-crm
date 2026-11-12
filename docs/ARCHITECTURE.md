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
