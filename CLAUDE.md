# OdoVox

Voice-first operating system for Indian dental clinics. Dentists speak; Odovox
turns speech into structured clinical records, prescriptions, treatment plans,
appointments, bills and WhatsApp follow-ups — with the doctor verifying every
record before it commits.

`README.md` is the full reference (stack, env vars, provider matrix, seed data).
**This file is only what an agent needs in order not to break things.** Don't
duplicate the README here.

## Running anything

**Node 20 is mandatory.** `engines` pins `>=20 <21`, and pnpm hard-fails with
`ERR_PNPM_UNSUPPORTED_ENGINE` on anything else — including the system default.
Every session starts with:

```bash
eval "$(fnm env)" && fnm use 20
```

`pnpm verify` (lint + typecheck + test) is the acceptance gate. Run it before
claiming anything works, and paste the output rather than summarising it.

## Tests — read this before trusting a red suite

The two suites have completely different needs:

- **`apps/web` — hermetic.** Pure vitest, no services, ~1.5s. If web is red, you
  broke something. Run it alone with `pnpm --filter @odovox/web test`.
- **`apps/api` — needs live Postgres, Redis and MinIO** (`docker compose up -d`).
  It runs against a **real database**, single-fork and sequential.

**The API suite accumulates state.** Clinic `joinCode`s are unique, and repeated
runs — especially alongside a long-lived `pnpm dev` — eventually exhaust the
generator's retries and fail ~160 files at once with
`Unique constraint failed on the fields: (joinCode)`. That is a dirty database,
not a code regression. Confirm before debugging: if your diff is web-only, it
cannot be the cause. Reset the dev DB rather than "fixing" the failure.

Because API tests share the dev database, **a running `pnpm dev` can make them
fail.** Consider stopping it before a full `pnpm verify`.

## Non-negotiables

- **Money is integer paise.** Never a float, never rupees in the DB. Format only
  at the edge.
- **PHI is encrypted at rest** (AES-256-GCM, app layer). Don't log it, don't put
  it in an error message, don't add a column that stores it in the clear.
- **`.env` is gitignored and agents are blocked from reading it.** Don't try;
  ask for the value you need.
- **RBAC is real.** Doctor / Receptionist / Admin gate actual routes. Rendering
  something a role cannot access leaks a permission — check `canAccess` rather
  than assuming symmetry looks nicer.
- **India defaults everywhere:** ₹ INR, +91, Asia/Kolkata, DD/MM/YYYY.

## Product rules — clinical information and who sees it

Owner-ruled, binding, and not re-litigable by inference from a frame:

1. **Reception-facing surfaces do not expose unnecessary clinical/medical information.**
   `/patients` and `/today` are reception surfaces. A medical flag being present in the
   payload is not a reason to render it.
2. **Doctor-facing clinical surfaces must surface relevant allergies/medical flags
   prominently.** `/consult` and `/home` are DOCTOR/ADMIN only precisely so they can.
3. **Allergy detection is a safety warning, not automatically a prescribing decision.**
4. **The dentist remains the final clinical decision maker.** Confirm is never hard-blocked
   by an advisory warning.
5. **Overrides must be auditable** — `confirmedWithWarning` →
   `CONSULTATION_CONFIRMED_WITH_WARNING`.
6. **AI must not invent medication substitutions.** No automatic "swap to X".
7. **AI must not silently convert uncertain information into clinical truth.**
8. **Clinical hard-block policies require an explicit clinical-policy decision** — never
   visual matching of a v9 frame.

The shorthand for rules 1 and 2: **RECEPTION QUEUE ≠ CLINICAL RECORD.**

Governance for decisions, not just data: technical implementation choices are yours to
make. Product, clinical, privacy/RBAC and workflow decisions, removing existing
functionality, and any place two legitimate product behaviours exist are NOT — implement no
irreversible change, classify the frame BLOCKED, explain the alternatives, recommend one,
and wait for the owner's ruling.

## The v9 → v10 UI migration (active work)

Governance lives in `docs/migration/`; plans in `docs/superpowers/plans/`.
Two rules from `04-migration-governance.md` that get violated by accident:

1. **A low pixel-diff percentage is not an acceptance criterion.** Gate B
   (`pnpm shots:fidelity`) reports a number; the number is never the target.
   Never change business logic to move it.
2. **Functionality, security, RBAC, accessibility and legal copy are never
   removed for pixel fidelity.** Where the implementation must differ from a v9
   frame, it gets recorded in `docs/migration/deviations.json` — it does not get
   silently "fixed" toward the frame.

Every difference lands in exactly one class in `deviations.json`:
`MUST-FIX` (implement v9 exactly) · `APPROVED-DEVIATION` and `PRODUCT-DECISION`
(**do not modify until the owner rules**) · `NOT-BUILT` (leave for its task).

**No task closes with an open decision of its own.** Raise and resolve them
inside the task that surfaced them; carrying thirty forward leaves a pile nobody
can reconstruct.

## Working here

- One task at a time from the plan file, checked off in the plan and the todo
  list as its done-when is actually met.
- Rulings from the owner are binding and get recorded verbatim — in
  `deviations.json`, and in a test where the ruling is enforceable. A ruling that
  only lives in a comment gets reverted by the next session.
- Prefer editing the plan over re-deriving it. If the plan contradicts a ruling,
  fix the plan in the same change.
- **Multiple agent sessions run on this repo.** Stage explicit paths; never
  `git add -A`, which silently sweeps another session's work into your commit.
