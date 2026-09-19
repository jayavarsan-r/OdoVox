# Migration acceleration — finishing v9→v10 as a working app

**Date:** 2026-09-07
**Supersedes the execution model of:** `2026-08-08-ui-migration-v9-v10-plan.md` (that plan's
frame specs and task bodies remain authoritative; only _how_ tasks are executed changes here)
**Owner direction:** "complete this migration much faster" + "in the end i want complete end to
end working app"

## Problem

26 of 81 frames are complete after nine tasks — roughly 2–3 frames per session, projecting 20–28
more sessions. Three things cause that rate, and only one of them is the actual work:

1. **Everything is serial.** One task at a time in one context, though the remaining frames fall
   into route families that share no files.
2. **Every product decision stalls the run.** ~20% of frames surface one; each stops work until
   the owner rules.
3. **Four "blockers" were one blocker.** #55, #58, #52, #90 all trace to a single root — the mock
   extractor returns nothing from fake audio, so conflict, voice-intake and narrative states can't
   be reached honestly.

A fourth cause is a misread rather than a cost: "NOT-BUILT" was taken to mean greenfield. Every
route for the remaining frames already exists. Of 51 remaining, 19 are MISMATCHED (pure restyle)
and most of the 30 NOT-BUILT are sheets and sub-states on live routes. Genuinely new surfaces
number about 8.

## The three rulings this plan executes under

Recorded verbatim in `deviations.json` (#91, #52/#90, #94) and in `CLAUDE.md`:

- **#91** — Share Rx PDF is **not** locked by an unresolved allergy conflict. Consistent with #53.
  Unblocks v9-45.
- **#52 / #90** — the canned fixture is built; `findings`/`procedureNarrative` extraction fields
  are **deferred** out of this migration. Render sections that have data. Unblocks v9-43 and the
  narrative sections of 27–30 as recorded deviations.
- **#94** — standing authority to rule non-clinical product decisions, logged and reversible.
  Clinical, privacy/RBAC and PHI still block.

## Gate C (new, deviation #95)

The deliverable is a working app. Every frame now passes three gates, not two:

| Gate  | Question                   | Mechanism                                             |
| ----- | -------------------------- | ----------------------------------------------------- |
| A     | Did we lose anything?      | `shots:compare` vs `baseline/`                        |
| B     | Does it match the design?  | `shots:fidelity` + **visual side-by-side inspection** |
| **C** | **Does it actually work?** | `pnpm gate:c` + Playwright journey specs              |

Gate C fails on: a route unreachable from the app's own chrome, a control wired to nothing, a
flow that cannot complete against the live API, or any placeholder/TODO surface.

Gate B's standing rule is unchanged and absolute: **the pixel-diff percentage is never the
acceptance criterion.** Visual inspection decides.

## Execution model

**Building is parallel; gating is serial and mine.**

Route families are disjoint, so implementers work simultaneously in isolated git worktrees. But
capture needs a dev server and a seeded database, which cannot be safely multiplied — so capture,
Gate B inspection and Gate C run centrally, in batches, on the merged branch. The two are
**pipelined**: while block N is being gated, blocks N+1…N+3 are being built.

Shared files are pre-split so no two agents touch the same lines:

- `deviations.json` → agents write `docs/migration/deviations.d/<block>.json`; a merge script folds
  them in. Never edited directly by an implementer.
- `screenshot-routes.ts` → all remaining shots are added up front as `pending: true`. An agent
  flips exactly its own one-line flag.
- `frame-status.json` → generated, never hand-edited.

### Blocks (51 frames, disjoint file sets)

| Block                  | Frames               | n   | Routes owned                                           |
| ---------------------- | -------------------- | --- | ------------------------------------------------------ |
| **0 · Infrastructure** | —                    | —   | harness, fixture, Gate C tooling                       |
| A · Schedule           | 46–49                | 4   | `(app)/schedule`                                       |
| B · Lab                | 56–61                | 6   | `(app)/lab/*`                                          |
| C · Money              | 51–55                | 5   | `(app)/today` checkout, `(app)/billing/*`              |
| D · Messages           | 62–66                | 5   | `(app)/messages/*`                                     |
| E · Inventory          | 67–69                | 3   | `(app)/inventory/*`                                    |
| F · Settings & account | 70–77, 80            | 9   | `(app)/more`, `(app)/clinic/*`, account, notifications |
| G · Home states        | 14–20                | 7   | `(app)/home`                                           |
| H · Onboarding tail    | 09–12                | 4   | `(onboarding)/*`                                       |
| I · Clinical states    | 22, 27–29, 36, 43–45 | 8   | consult, patients — **depends on Block 0's fixture**   |

Blocks A–H are mutually independent and may run in any order or all at once. Block I runs after
Block 0.

---

## Task 0 — Infrastructure that makes the rest parallel

**Goal:** an implementer can be handed one block and produce mergeable work without reading the
3,689-line spec, touching a shared file, or running a database.

**Why:** without this, parallel agents collide on `deviations.json` and `screenshot-routes.ts`, and
each burns context re-scanning the master spec. This task is the whole speed-up; everything after
it is ordinary work.

**Files:**

- `scripts/extract-v9-frames.ts` (new) — split `odovox-v9-master.html` into
  `docs/migration/v9-frames/v9-NN.html`, self-contained with the shared `<style>` and `<svg>` defs
- `scripts/merge-deviations.ts` (new) — fold `docs/migration/deviations.d/*.json` into
  `deviations.json`, rejecting duplicate ids
- `scripts/gate-c.ts` (new) — reachability + dead-control audit
- `scripts/screenshot-routes.ts` — add every remaining shot as `pending: true`
- `package.json` — `shots:extract`, `dev:merge`, `gate:c`
- `docs/migration/BLOCK-BRIEF.md` (new) — the standing brief every implementer reads

**Steps:**

1. Write the frame extractor, reusing `v9-reference.ts`'s `.frame-card` parsing. Verify 81 files.
2. Write the deviations merge script + a test that duplicate ids fail loudly.
3. Add the remaining shots to the route table, `pending: true`.
4. Write `gate-c.ts`: crawl every route from the nav, assert no `href="#"`, no handler-less
   `<button>`, no "Coming soon"/TODO text.
5. Write the standing block brief: the three gates, the rulings, what blocks vs what is decidable.

**Done when:** `ls docs/migration/v9-frames/*.html | wc -l` → 81; `pnpm gate:c` exits non-zero on a
seeded dead control and zero once removed; `pnpm shots:frame-status` still sums to 81.

---

## Task 1 — The canned-transcript fixture

**Goal:** the mock STT/extractor deterministically produces the three transcripts the unreachable
states need, so those states are reached through the real app rather than faked.

**Why:** unblocks frames 27, 28, 29, 36 and the 44/45 captures — 6 frames from one task, and the
single largest stall on the board. Resolves #55 and #58.

**Files:** `apps/api/src/lib/ai/mock-*.ts`, `packages/db/prisma/seed.ts`, harness route table.

**Steps:**

1. Add a fixture selector to the mock provider keyed off a seeded marker (never off `NODE_ENV`).
2. Transcript 1 — prescribes amoxicillin for the penicillin-allergic seeded patient (27, 28).
3. Transcript 2 — seven medicines (29).
4. Transcript 3 — a full intake: name, age, phone, complaint (36).
5. Seed the conflict patient and the demo visit that reaches each.

**Done when:** the harness captures 27, 28, 29 and 36 without any state being set by test code —
each reached by clicking the same controls a user clicks.

---

## Tasks 2–10 — The nine blocks

Each block is one dispatch, and each carries the same contract:

- **Read** `docs/migration/BLOCK-BRIEF.md`, then `docs/migration/v9-frames/v9-NN.html` and the PNG
  at `docs/migration/screenshots/v9-reference/v9-NN.png` for each frame it owns.
- **Never** paste v9 HTML into the app. It is a design specification.
- **Build** to the design; **wire** every control (Gate C); **test** the logic that has logic.
- **Write** deviations to `docs/migration/deviations.d/<block>.json` only.
- **Flip** its own `pending: true` flags off.
- **Block** — do not decide — on anything clinical, privacy/RBAC or PHI. Non-clinical product
  decisions are decidable under #94 and must be logged.
- **Done when:** `pnpm verify` passes in its worktree and every owned control is wired.

## Task 11 — End-to-end journeys

**Goal:** the app's real flows complete against the live API, proving Gate C at the system level.

**Files:** `e2e/journeys.spec.ts` (new)

Journeys: sign-up → clinic → home · consult record → verify → save → appears in record ·
patient → case → sitting → bill → payment · schedule → book → shows on Today · lab case → status →
inbox · inventory → stock out → reorder. Doctor and receptionist both, asserting RBAC divergence.

**Done when:** every journey passes headless against a freshly seeded database.

## Task 12 — Final gate and the decision review list

Run all three gates across all 81 frames. Produce the owner's review list of every decision taken
under #94, each reversible. Ledger sums to exactly 81.

## Global constraints

Unchanged from the 2026-08-08 plan, and additionally:

1. Money is integer paise. PHI is encrypted at rest and never logged. `.env` is unreadable — ask.
2. RBAC is real; check `canAccess`. Reception surfaces do not expose clinical information.
3. Never `git add -A` — other agent sessions share this repo. Stage explicit paths.
4. A frame closes on Gate A + Gate B + Gate C. Never on a diff percentage.
5. Node 20: `eval "$(fnm env)" && fnm use 20`.
