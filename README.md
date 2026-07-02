# Odovox

**Voice-first operating system for Indian dental clinics.** Dentists speak naturally; Odovox turns
speech into structured clinical records, prescriptions, multi-sitting treatment plans, appointments,
bills, and WhatsApp follow-ups — with the doctor verifying every record before it's committed.

> Status: **Phase 9.5** — the full clinic workflow is built (auth → voice consult → queue → scheduling
> → lab/inventory → billing → WhatsApp). Everything runs locally on free, deterministic **mock**
> providers; flip one env var per integration to go live.

---

## Table of contents

1. [What's inside](#whats-inside)
2. [Tech stack](#tech-stack)
3. [Repository layout](#repository-layout)
4. [Set up on a new laptop](#set-up-on-a-new-laptop) ← start here
5. [Demo login & seed data](#demo-login--seed-data)
6. [Provider mock ↔ real matrix](#provider-mock--real-matrix)
7. [Everyday commands](#everyday-commands)
8. [Environment variables](#environment-variables)
9. [Architecture notes](#architecture-notes)
10. [Troubleshooting](#troubleshooting)
11. [Security baseline](#security-baseline)

---

## What's inside

| Domain | Highlights |
| --- | --- |
| **Auth & onboarding** | Phone + OTP (mock logs the code), JWT RS256, clinic create/join by code, RBAC (Doctor / Receptionist / Admin) |
| **Voice + AI pipeline** | Record → Sarvam STT → Gemini extraction → safety layer → doctor verification card → single-transaction commit. Live progress over SSE; short-clip inline dictation for intake / prescription / search |
| **Live queue** | Realtime waiting-room board (Socket.IO), check-in, in-chair, checkout, "doctor is recording" indicators |
| **Scheduling** | Appointments, per-doctor availability + day-offs, recurring slots, auto-scheduled multi-sitting follow-ups, NO_SHOW sweep, WhatsApp reminders |
| **Clinical** | Multi-sitting treatment plans, tooth chart (FDI), prescription templates, PDF prescriptions |
| **Lab & inventory** | Lab vendors + case lifecycle, inventory categories/items, stock movements, low-stock alerts |
| **Billing** | Bills + items, GST, Cash/UPI/Card/Bank + Razorpay links & webhooks, refunds, statement PDFs, reports |
| **WhatsApp** | Consent gate, outbound send pipeline (queued, idempotent, budget-capped), inbound + status webhooks, receptionist inbox, daily cost tracking |

All money is stored in **paise** (integers). PHI is encrypted at rest with AES-256-GCM at the app
layer. India defaults everywhere: ₹ INR, +91, Asia/Kolkata, DD/MM/YYYY.

---

## Tech stack

| Layer | Tech |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js 15 (App Router, PWA) + Tailwind v4 + shadcn/ui + Framer Motion |
| State | Zustand (client) + TanStack Query v5 (server) |
| Backend | Fastify v5 + Socket.IO |
| ORM / DB | Prisma 6 + PostgreSQL 16 |
| Cache / queue | Redis 7 (ioredis) + BullMQ |
| Object storage | S3-compatible — MinIO in dev; S3 / R2 / Wasabi in prod |
| Validation | Zod (shared between web & api via `@odovox/types`) |
| Auth | JWT (jose, RS256) + httpOnly refresh cookies |
| Providers | STT (Sarvam), AI (Gemini), OTP (MSG91), Payments (Razorpay), WhatsApp (AiSensy) — each with a mock |
| Logging / errors | Pino + Sentry (optional) |
| Testing | Vitest (unit + integration) + Playwright (e2e) |

Everything is TypeScript strict mode.

---

## Repository layout

```
apps/
  web/          Next.js 15 PWA (the whole clinic UI)
  api/          Fastify backend — routes, BullMQ workers, providers, plugins
packages/
  db/           Prisma schema, migrations, client, seed + starter templates
  types/        Shared Zod schemas + inferred TS types (the API/web contract)
  ui/           Design tokens (CSS vars) + Tailwind preset
  config/       Shared eslint / tsconfig / prettier
docs/           voice-pipeline.md, billing.md, whatsapp.md, design-system.md, acceptance checklists
e2e/            Playwright specs
```

---

## Set up on a new laptop

### 0. Prerequisites

| Tool | Version | Install |
| --- | --- | --- |
| **Node** | 20.x (`>=20 <21`) | `nvm install 20 && nvm use` (repo has `.nvmrc`) |
| **pnpm** | 10.x (9+ works) | `corepack enable` (uses the pinned `pnpm@10.33.0`) |
| **Docker** | any recent | Docker Desktop — runs Postgres, Redis, MinIO |
| **OpenSSL** | any | preinstalled on macOS/Linux — for generating keys |

### 1. Clone & install

```bash
git clone <repo-url> OdoVox
cd OdoVox
nvm use
pnpm install
```

### 2. Create your `.env`

```bash
cp .env.example .env
```

Then generate the three secrets and paste them in:

```bash
# PHI encryption key — must decode to exactly 32 bytes
echo "PHI_ENCRYPTION_KEY=$(openssl rand -base64 32)"

# Cookie secret — 32+ bytes
echo "COOKIE_SECRET=$(openssl rand -hex 32)"

# JWT RS256 key pair (base64-encoded PEM, single line)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private.pem
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
echo "JWT_PRIVATE_KEY=$(base64 < jwt_private.pem | tr -d '\n')"
echo "JWT_PUBLIC_KEY=$(base64 < jwt_public.pem | tr -d '\n')"
rm jwt_private.pem jwt_public.pem   # don't leave PEMs on disk
```

Everything else in `.env.example` already has sensible dev defaults (all providers are `mock`, so no
paid API keys are needed to run locally). The API **validates every var at boot** and refuses to
start if anything is missing or malformed.

> **macOS gotcha — native Postgres/Redis shadowing Docker.** If you already run Postgres on 5432 or
> Redis on 6379 (common via Homebrew), the Docker containers collide and Prisma gets denied. Use
> alternate host ports instead:
> ```bash
> # in .env:
> POSTGRES_PORT=5433
> REDIS_PORT=6380
> DATABASE_URL=postgresql://odovox:odovox@localhost:5433/odovox?schema=public
> REDIS_URL=redis://localhost:6380
> ```
> Then `docker compose up -d` republishes on the free ports. (This is the default the repo's own
> `.env` uses.)

### 3. Start infrastructure (Postgres + Redis + MinIO)

```bash
docker compose up -d
docker compose ps        # all three should be healthy
```

Services published on localhost: **Postgres** `5432`, **Redis** `6379`, **MinIO** `9000` (S3 API) +
`9001` (web console, login `odovox` / `odovox-dev-password`). Override any with the `*_PORT` env vars.

### 4. Migrate, seed, and initialize storage

```bash
pnpm db:migrate     # apply Prisma migrations
pnpm db:seed        # seed the demo clinic + create the MinIO bucket (runs storage:init too)
```

### 5. Run everything

```bash
pnpm dev            # web + api in watch mode (Turborepo)
```

- **Web** → http://localhost:3000
- **API** → http://localhost:4000
- **MinIO console** → http://localhost:9001

The API prints a boot banner showing the active STT / AI / OTP providers so you always know whether
you're on mocks or real keys.

### 6. Smoke test

```bash
curl http://localhost:4000/health
# { "status": "ok", "db": "ok", "redis": "ok", ... }
```

Then open http://localhost:3000, log in with the demo doctor below, open a patient, and record a
consultation — the progress strip should advance **Transcribing → Understanding → verification card**.

---

## Demo login & seed data

`pnpm db:seed` creates **Smile Dental Care** (`joinCode: SMILE7`) fully populated. In dev the OTP is
always **`123456`** (also printed to the API console as `[MOCK OTP] …`).

| Role | Name | Phone | OTP |
| --- | --- | --- | --- |
| Doctor | Dr. Asha Menon | `9000000001` | `123456` |
| Receptionist | Ravi Kumar | `9000000002` | `123456` |

Seeded so demos have something to show: a live queue (waiting / in-chair / checkout), patients
(Meera, Arjun, Fatima, Akhilesh), 1 CONFIRMED + 1 PENDING_REVIEW consultation, a lab vendor + 3 cases,
inventory with a low-stock item, and prescription starter templates (RCT pack, Post-extraction, …).

---

## Provider mock ↔ real matrix

Every external integration ships a deterministic **mock** (free, offline, used by CI and dev) behind
a clean interface. Flip the env var to go live for that one integration — no code changes.

| Integration | Env var | `mock` (default) | Real |
| --- | --- | --- | --- |
| Speech-to-text | `STT_PROVIDER` | canned transcripts | `sarvam` (+ `SARVAM_API_KEY`) |
| AI extraction | `AI_PROVIDER` | keyword pattern-match | `gemini` (+ `GEMINI_API_KEY`) |
| OTP / SMS | `OTP_PROVIDER` | logs code to console | `msg91` (+ MSG91 keys) |
| Payments | `PAYMENT_PROVIDER` | deterministic, no network | `razorpay` (+ Razorpay keys) |
| WhatsApp | `WHATSAPP_PROVIDER` | logs sends | `aisensy` (+ AiSensy keys) |

For manual voice testing with real transcription: `STT_PROVIDER=sarvam AI_PROVIDER=gemini pnpm dev`.
See [`docs/voice-pipeline.md`](docs/voice-pipeline.md) for the full mocking policy.

---

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run web + api in watch mode |
| `pnpm build` | Build all packages/apps |
| `pnpm verify` | **Lint + typecheck + test** — the acceptance gate (run before every commit) |
| `pnpm lint` | ESLint across the monorepo |
| `pnpm typecheck` | `tsc --noEmit` across the monorepo |
| `pnpm test` | Vitest unit + integration tests |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:seed` | Seed the demo clinic (`SMILE7`) + init MinIO bucket |
| `pnpm db:studio` | Open Prisma Studio (DB browser) |
| `pnpm storage:init` | Create/verify the S3 bucket only |
| `pnpm format` | Prettier write across the repo |

Run a single package's tests, e.g. the API: `pnpm --filter @odovox/api test`.
Playwright e2e: `pnpm exec playwright test`.

---

## Environment variables

Full list lives in [`.env.example`](.env.example) with inline notes. Grouped overview:

- **App / web:** `NODE_ENV`, `LOG_LEVEL`, `PORT`, `NEXT_PUBLIC_API_URL`, `CORS_ORIGINS`
- **Data:** `DATABASE_URL`, `REDIS_URL` (+ `POSTGRES_PORT` / `REDIS_PORT` for docker publishing)
- **Auth / crypto:** `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`,
  `COOKIE_SECRET`, `PHI_ENCRYPTION_KEY`, `PHI_KEY_VERSION`
- **Storage (S3/MinIO):** `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`,
  `S3_FORCE_PATH_STYLE`, `MINIO_PORT`, `MINIO_CONSOLE_PORT`
- **Providers:** `STT_PROVIDER`/`SARVAM_*`, `AI_PROVIDER`/`GEMINI_*`, `OTP_PROVIDER`/`MSG91_*`,
  `PAYMENT_PROVIDER`/`RAZORPAY_*`, `WHATSAPP_PROVIDER`/`AISENSY_*`
- **Chaos/testing knobs:** `PAYMENT_MOCK_FAILURE_RATE`, `MOCK_WHATSAPP_FAILURE_RATE`
- **Observability:** `SENTRY_DSN` (blank = disabled)

`CORS_ORIGINS` must include the web origin (`http://localhost:3000` in dev). It gates both REST **and**
the consultation SSE stream — if the web app can't reach the API cross-origin, voice progress stalls.

---

## Architecture notes

- **The voice contract** ([`docs/voice-pipeline.md`](docs/voice-pipeline.md)) is the source of truth
  for the STT/AI provider abstractions, the BullMQ queues, the SSE state machine, the safety layer,
  and the confirm transaction. The consultation flow is: browser records → direct presigned upload to
  S3 → `POST /consultations/:id/process` → `stt-queue` → `extraction-queue` → events published to
  Redis → streamed to the client over SSE → doctor verifies → single `$transaction` commit.
- **Workers run in-process today** (`apps/api/src/queues/start-workers.ts`) with a clean boundary
  (injected deps, no request context) so they can split into a standalone process later.
- **Clinic isolation** is enforced by Prisma middleware — every clinic-scoped query must carry a
  `clinicId` or it throws. Cross-clinic data leakage is structurally prevented.
- **Realtime** (queue board, "recording now") is broadcast-only over Socket.IO; all mutations go
  through REST, which owns RBAC/validation/audit.

---

## Troubleshooting

**`P1010: User was denied access on the database`** — your `localhost:5432` is answered by a native
Postgres shadowing Docker. Use `POSTGRES_PORT=5433` / `REDIS_PORT=6380` (see the macOS gotcha above)
and point the URLs at those ports. Confirm with `lsof -nP -iTCP:5432 -sTCP:LISTEN` and
`docker compose ps`.

**`connect ECONNREFUSED ::1:4000` from the web app** — the API isn't running or crashed at boot.
Check the `pnpm dev` terminal; the boot **preflight** fails loud with the offending component
(Prisma, Redis, env, or storage).

**Consultation stuck on "Transcribing"** — the browser can't read the SSE stream. Ensure
`CORS_ORIGINS` includes the web origin and Redis + MinIO are up (the STT worker downloads the audio
from S3). Regression-tested in `apps/api/test/consultation-sse-cors.test.ts`.

**"Could not send the code" toast** — the OTP call failed. `curl http://localhost:4000/health`; if
`db`/`redis` is `"error"`, that's the cause. In dev the code is always `123456`.

**`pnpm db:migrate` P3005 (schema not empty)** — baseline it:
`cd packages/db && npx prisma migrate resolve --applied <migration-name>`, or wipe and retry:
`docker compose down -v && docker compose up -d && pnpm db:migrate && pnpm db:seed`.

**`EADDRINUSE 0.0.0.0:4000`** — a stale API is holding the port:
`lsof -nP -iTCP:4000 -sTCP:LISTEN -t | xargs kill -9`.

**Audio uploads/transcription fail** — MinIO isn't up or the bucket is missing. `docker compose ps`,
then `pnpm storage:init`. Browse objects at the MinIO console (http://localhost:9001).

---

## Security baseline

- Helmet (CSP + HSTS, no `X-Powered-By`), strict CORS allowlist, global rate limiting.
- All env vars validated via Zod at boot; the server refuses to start on misconfig.
- JWT RS256; refresh tokens stored SHA-256-hashed (never plaintext) in httpOnly cookies.
- Prisma middleware enforces `clinicId` scoping on every clinic-scoped query.
- Every mutation writes an `AuditLog` row.
- PHI fields encrypted at rest (AES-256-GCM) with tamper detection and key versioning.
- No secrets in git: `.env` is gitignored; `.env.example` holds placeholders only.

## License

Proprietary — © Odovox.
