# Silwasa CMS

Custom website + CMS for Silwasa IT Solutions. pnpm monorepo:

- `apps/web` — Next.js (App Router) public site + admin UI, port **3000**
- `apps/api` — Express + Prisma REST API, port **4000**
- `packages/shared` — shared types

## Run locally (VS Code)

Prerequisites: Node 20.11+, pnpm 10 (`npm i -g pnpm`), and either Docker Desktop **or** a local PostgreSQL 16.

```bash
pnpm install                 # also runs `prisma generate`
cp .env.example .env         # Windows: copy .env.example .env
```

Fill the two secrets in `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # ENCRYPTION_KEY
```

Database (Docker):

```bash
pnpm db:up                   # starts Postgres on localhost:5432
pnpm db:migrate              # when prompted for a name, enter: init
pnpm db:generate
```

Without Docker, create a database and user yourself and change `DATABASE_URL` / `DIRECT_DATABASE_URL` in `.env`.

Create the roles and your first admin (once). Use a real email and a passphrase of 12+ characters:

```bash
# macOS/Linux
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_NAME="Your Name" SEED_ADMIN_PASSWORD='a long passphrase here' pnpm db:seed
# Windows PowerShell
$env:SEED_ADMIN_EMAIL="you@example.com"; $env:SEED_ADMIN_NAME="Your Name"; $env:SEED_ADMIN_PASSWORD="a long passphrase here"; pnpm db:seed
```

Start both apps:

```bash
pnpm dev
```

Check it works:

- http://localhost:4000/api/v1/health → `{"success":true,...}`
- http://localhost:4000/api/v1/health/ready → 200 when Postgres is connected, 503 otherwise
- http://localhost:3000/status → shows API and database status

- http://localhost:3000/admin/login → sign in with the seeded admin

Other commands: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

See `docs/PROGRESS.md` for status and `docs/ARCHITECTURE.md` for decisions.
