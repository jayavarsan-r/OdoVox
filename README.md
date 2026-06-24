# Odovox

Voice-first operating system for Indian dental clinics. Dentists speak naturally; Odovox turns
speech into structured clinical records, prescriptions, treatment plans, and appointments.

This repository is currently at **Phase 0 — Foundation**: a production-grade monorepo chassis
(no business features yet). It boots a Fastify API, a Next.js PWA token-showcase page, Postgres,
and Redis, with security, encryption, audit logging, and clinic-scoped data isolation baked in.

## Stack

| Layer            | Tech                                                             |
| ---------------- | --------------------------------------------------------------- |
| Monorepo         | pnpm workspaces + Turborepo                                      |
| Frontend         | Next.js 15 (App Router) + Tailwind v4 + shadcn/ui + Framer Motion |
| State            | Zustand (client) + TanStack Query v5 (server)                   |
| Backend          | Fastify v5                                                       |
| ORM / DB         | Prisma 6 + PostgreSQL 16                                         |
| Cache / queue    | Redis (ioredis) + BullMQ                                         |
| Validation       | Zod (shared between web & api)                                   |
| Auth             | JWT (jose, RS256) + httpOnly refresh cookies                    |
| Logging / errors | Pino + Sentry                                                    |
| Testing          | Vitest (unit) + Playwright (e2e scaffold)                       |

Everything is TypeScript strict mode. All money is stored in **paise** (integers). PHI is
encrypted at rest with AES-256-GCM at the application layer. India defaults: ₹ INR, +91, Asia/Kolkata,
DD/MM/YYYY.

## Repository layout

```
apps/
  web/          Next.js 15 PWA (token showcase page for Phase 0)
  api/          Fastify backend (health route + full security/plugin chassis)
packages/
  db/           Prisma schema, client, seed
  types/        Shared Zod schemas + inferred TS types
  ui/           Design tokens (CSS vars) + Tailwind preset
  config/       Shared eslint / tsconfig / prettier
```

## Prerequisites

- Node 20 LTS (`nvm use` picks it up from `.nvmrc`)
- pnpm 9+ (`corepack enable` or install globally)
- Docker (for local Postgres + Redis)

## Setup

### 1. Install dependencies

```bash
nvm use
pnpm install
```

### 2. Create your `.env`

```bash
cp .env.example .env
```

Fill in the secrets. Generate them with the one-liners below.

**PHI encryption key (32 bytes, base64):**

```bash
openssl rand -base64 32
```

**Cookie secret (32+ bytes):**

```bash
openssl rand -hex 32
```

**JWT RS256 key pair (base64-encoded PEM):**

```bash
# Private key (PKCS#8)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private.pem
# Public key (SPKI)
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem

# Base64-encode them for the .env file (single line, no wrapping):
echo "JWT_PRIVATE_KEY=$(base64 < jwt_private.pem | tr -d '\n')"
echo "JWT_PUBLIC_KEY=$(base64 < jwt_public.pem | tr -d '\n')"

# Clean up the on-disk PEMs once copied into .env
rm jwt_private.pem jwt_public.pem
```

Paste the resulting values into `.env`. The API validates every env var at boot via Zod and
**refuses to start** if anything is missing or malformed (e.g. `PHI_ENCRYPTION_KEY` must decode
to exactly 32 bytes).

### 3. Start Postgres + Redis

```bash
docker compose up -d   # or: docker-compose up -d
```

> **Port already in use?** If you already run Postgres/Redis locally on 5432/6379,
> start the containers on alternate host ports and point `.env` at them:
>
> ```bash
> POSTGRES_PORT=5433 REDIS_PORT=6380 docker compose up -d
> # then in .env: DATABASE_URL=...localhost:5433...  REDIS_URL=redis://localhost:6380
> ```
>
> The compose file defaults to 5432/6379 when these vars are unset.

### 4. Migrate & seed the database

```bash
pnpm db:migrate
pnpm db:seed
```

### 5. Run everything

```bash
pnpm dev
```

- Web → http://localhost:3000 (token showcase page)
- API → http://localhost:4000

### 6. Smoke test

```bash
curl http://localhost:4000/health
# { "status": "ok", "db": "ok", "redis": "ok", "uptime": ..., "version": "..." }
```

## Useful commands

| Command            | What it does                                          |
| ------------------ | ----------------------------------------------------- |
| `pnpm dev`         | Run web + api in watch mode                           |
| `pnpm build`       | Build all packages/apps                               |
| `pnpm verify`      | Lint + typecheck + test (the Phase 0 acceptance gate) |
| `pnpm lint`        | ESLint across the monorepo                            |
| `pnpm typecheck`   | `tsc --noEmit` across the monorepo                    |
| `pnpm test`        | Vitest unit tests                                     |
| `pnpm db:migrate`  | Apply Prisma migrations                               |
| `pnpm db:seed`     | Seed the demo clinic (`SMILE7`)                       |
| `pnpm db:studio`   | Open Prisma Studio                                    |
| `pnpm format`      | Prettier write across the repo                        |

## Troubleshooting

### `P1010: User was denied access on the database`
Your host's `localhost:5432` is being answered by a **different** Postgres than the Odovox
container — most often a native Homebrew/Postgres.app instance that shadows `localhost` over
Docker. That instance has no `odovox` role, so Prisma is denied. Two fixes:

- **Use non-conflicting ports (recommended, non-destructive):** set `POSTGRES_PORT=5433` and
  `REDIS_PORT=6380` in `.env`, update `DATABASE_URL`/`REDIS_URL` to those ports, then
  `docker compose up -d` to republish the containers on the free ports.
- **Or** the credentials genuinely drifted from the container's seeded volume — wipe and
  rebuild:
  ```bash
  docker compose down -v   # wipes the Postgres volume
  docker compose up -d
  pnpm db:migrate && pnpm db:seed
  ```

Confirm which Postgres answers `localhost`:
```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN          # is a native postgres listening on 127.0.0.1?
docker compose ps                         # what host port did the container publish?
```

### `connect ECONNREFUSED ::1:4000` from the web app
The API isn't running, or it crashed during boot. Check the terminal where you ran `pnpm dev` —
the actual error (Prisma, Redis, env validation, or a failed **preflight** check) is logged
there. The API now runs a boot-time preflight that fails loud with the offending component.

### "Could not send the code" toast in dev
The OTP API call failed. Check `curl http://localhost:4000/health` — if `db` or `redis` is
`"error"`, that infra component is the cause.

### `pnpm db:migrate` fails with P3005 (schema not empty)
You're applying migrations on a DB previously initialized via `db push`. Baseline it:
```bash
cd packages/db && npx prisma migrate resolve --applied <migration-name>
```
Or wipe and retry: `docker compose down -v && docker compose up -d && pnpm db:migrate`.

### `EADDRINUSE: address already in use 0.0.0.0:4000`
A previous API process is still holding port 4000:
```bash
lsof -nP -iTCP:4000 -sTCP:LISTEN -t | xargs kill -9
```

## Security baseline (Phase 0)

- Helmet (CSP + HSTS, no `X-Powered-By`), CORS allowlist, global rate limiting.
- All env vars validated via Zod at boot.
- JWT RS256; refresh tokens stored SHA-256-hashed, never plaintext.
- Prisma middleware enforces `clinicId` scoping on every clinic-scoped query and throws otherwise.
- Every mutation writes an `AuditLog` row.
- PHI fields encrypted at rest (AES-256-GCM) with tamper detection.
- No secrets in git: `.env` is gitignored; `.env.example` holds placeholders only.

## License

Proprietary — © Odovox.
