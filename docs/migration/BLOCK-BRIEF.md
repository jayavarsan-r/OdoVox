# Block brief — standing instructions for a migration implementer

You own **one block**: a small set of v9 frames on a route family nobody else is touching.
Other implementers are working in parallel in their own worktrees. This document is the
contract you work under. Read it once, fully, before you open a file.

---

## 1. What you are building from

For each frame you own:

| What                                     | Where                                                           |
| ---------------------------------------- | --------------------------------------------------------------- |
| **The spec digest — read this**          | `docs/migration/v9-frames/v9-NN.md`                             |
| The renderable frame (open in a browser) | `docs/migration/v9-frames/v9-NN.html`                           |
| The reference PNG (look at it)           | `docs/migration/screenshots/v9-reference/v9-NN.png`             |
| Shared design tokens                     | `docs/migration/v9-frames/_v9-tokens.css`                       |
| The frame's task body                    | `docs/superpowers/plans/2026-08-08-ui-migration-v9-v10-plan.md` |

**Look at the PNG.** Not as a formality — the digest tells you structure, the PNG tells you
weight, rhythm and density. A frame built from markup alone reliably comes out too loose.

### The v9 HTML is a design specification, never code to paste

This is the single most important rule in this document, and it has been violated before.

The spec is static HTML with hardcoded hex values and pixel measurements. The app is React
with a shared Tailwind preset and a design-system component library. Pasting spec markup
imports the spec's private values in place of the design system's tokens, and produces a
screen that looks right once and drifts from every other screen forever.

**Read the spec. Measure it. Then build the screen properly** out of `components/ds` and the
preset's tokens. If a token you need doesn't exist, add it to the preset — don't inline a hex.

---

## 2. The three gates

A frame is complete when it passes all three. Not two.

### Gate A — did we lose anything?

Functionality, security, RBAC, accessibility and legal copy are **never** removed to match a
frame. The v9 frames are a design mock; they don't know about the permissions, the encrypted
fields or the empty states the real app has. Where the implementation must differ, it gets
**recorded** (§4) — it does not get silently "fixed" toward the frame.

### Gate B — does it match the design?

Visual side-by-side inspection against the reference PNG.

**The pixel-diff percentage is never the acceptance criterion.** `shots:fidelity` prints a
number; the number is not the target and you must never change business logic to move it. A
frame at 3% that reads correctly passes. A frame at 0.4% with the wrong type scale does not.

### Gate C — does it actually work?

New, and the reason this migration exists in the form it does. The owner's words: _"in the
end i want complete end to end working app."_

- The route is **reachable** by real navigation from the app's own chrome.
- Every control is **wired** to a real endpoint or a real client action.
- The flow it belongs to **completes end to end** against the live API on seeded data.
- **No dead buttons, no placeholder screens, no TODO surfaces.**

Run `pnpm gate:c`. It catches dead buttons, links to nowhere, placeholder copy and orphan
routes — the class of bug where a screen photographs perfectly and does nothing. It is static;
it cannot check that your endpoint returns the right thing. That part is on you.

If a control on your frame has no endpoint behind it, **build the endpoint**. If building it
means a product or clinical decision, see §3.

---

## 3. What you may decide, and what stops you

### You decide (owner ruling #94 — "decide non-clinical, log it")

Layout, spacing, copy, component choice, information architecture, workflow ordering,
technical implementation. Make the call, build it, and **log it** as an APPROVED-DEVIATION
(§4) with your reasoning. The owner reviews the list at the end and may reverse any of it.

Don't stall on these. Stalling is what this whole restructure exists to end.

### You STOP and mark the frame BLOCKED

- **Clinical decisions.** Anything about what a clinician is shown, warned about, or
  prevented from doing.
- **A clinical hard block.** Never infer one from a frame greying out a button. Product rules
  4 and 8 reserve these for the owner. (This is exactly what happened with #91.)
- **Privacy, RBAC, or anything touching PHI.** Who can see what is never a visual decision.
- **Removing existing functionality.**

Write the deviation with `"class": "PRODUCT-DECISION"`, `"status": "open"`, the alternatives,
and your recommendation. Then move to your next frame — don't wait.

### The eight product rules are not re-litigable

They're in `CLAUDE.md`. The two that catch people:

1. **Reception surfaces do not expose unnecessary clinical information.** `/patients` and
   `/today` are reception surfaces. A medical flag being in the payload is not permission to
   render it.
2. **Doctor clinical surfaces must surface allergies prominently.** `/consult` and `/home`.

Shorthand: **RECEPTION QUEUE ≠ CLINICAL RECORD.**

The boundary is enforced **server-side** via `isClinicalRole()`. Never re-implement it in a
component — a field filtered in React already travelled to the browser.

---

## 4. Recording a deviation — never edit the shared ledger

`docs/migration/deviations.json` is the migration's single ledger and every parallel
implementer wants to append to it at once. **Do not open it to write.**

Write `docs/migration/deviations.d/<your-block>.json` — a plain array:

```json
[
  {
    "id": 96,
    "class": "APPROVED-DEVIATION",
    "frames": ["v9-58"],
    "summary": "One line: what differs from the frame",
    "reason": "Why. The constraint the frame didn't know about. Enough that someone can review or reverse this without asking you.",
    "status": "approved"
  }
]
```

- **Ids are global.** Take the next free one from `deviations.json` and increment within your
  own fragment. Do not restart at 1 — the merge rejects duplicates.
- Classes: `MUST-FIX` · `APPROVED-DEVIATION` · `PRODUCT-DECISION` · `NOT-BUILT` ·
  `NOT-CAPTURED`.
- A deviation without its `reason` is a note nobody can act on. The merge rejects it.

Verify with `pnpm dev:merge --check`.

---

## 5. Screenshots

Every remaining shot is already in `scripts/screenshot-routes.ts` marked `pending: true`.
**Flip only your own frames' flags off** — one line each. Don't reorder the table, don't
rename a slug (it orphans the baseline), don't add entries outside your block.

You do **not** run the capture. Capture needs a dev server and a seeded database, which can't
be safely multiplied across parallel worktrees. The coordinator captures and inspects
centrally, in batches, after your block merges.

---

## 6. Non-negotiables

- **Node 20.** `eval "$(fnm env)" && fnm use 20` at the start of every session.
- **Money is integer paise.** Never a float, never rupees in the DB. Format at the edge only.
- **PHI is encrypted at rest** (AES-256-GCM). Don't log it, don't put it in an error message,
  don't add a plaintext column.
- **`.env` is gitignored and you are blocked from reading it.** Don't try — ask for the value.
- **RBAC is real.** Check `canAccess`; don't assume symmetry because it looks tidier.
- **India defaults:** ₹ INR, +91, Asia/Kolkata, DD/MM/YYYY.
- **Never `git add -A`.** Other agent sessions share this repo and it will sweep their work
  into your commit. Stage explicit paths, always.

---

## 7. Done means

```bash
eval "$(fnm env)" && fnm use 20
pnpm verify          # lint + typecheck + test
pnpm gate:c          # no dead controls, placeholders or orphan routes
pnpm dev:merge --check
```

Report **lint errors and warnings separately.** Never say "lint clean" when warnings exist.

Then report back:

- frames done, and for each: what you built and any deviation ids you filed
- anything you marked BLOCKED, and why
- test counts, pasted — not summarised
- what you did **not** do, and why

`apps/web` tests are hermetic and fast (~1.5s). `apps/api` tests need live Postgres, Redis and
MinIO (`docker compose up -d`) and share the dev database — a running `pnpm dev` can make them
fail, and a `joinCode` unique-constraint avalanche means a dirty DB, not your regression.
