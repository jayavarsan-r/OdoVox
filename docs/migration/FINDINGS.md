# v9 → v10 migration — findings and changes

A readable record of what this migration has actually changed and what it uncovered.
`deviations.json` is the machine ledger and the legal record; this is the document you read
end to end.

**Updated after every frame closes.** Status is generated — run `pnpm shots:frame-status`.

---

## Where it stands

|                                                |             |
| ---------------------------------------------- | ----------- |
| **Complete**                                   | **45 / 81** |
| Mismatched (captured, design work outstanding) | 2           |
| Not built                                      | 29          |
| Cross-cutting behaviours (not screens)         | 3           |
| Not capturable                                 | 1           |
| Out of scope                                   | 1           |

A frame is complete only when it passes **Gate A** (nothing lost), **Gate B** (matches the
design, judged by eye — never by a pixel-diff percentage) and **Gate C** (the screen actually
works: reachable, wired, completes end to end, no dead controls).

---

## The pattern that keeps recurring

Across the settings, inventory, lab and schedule clusters, the recurring finding is **not
missing code**. It is working code that nobody can reach, or that presents itself wrongly:

- Inventory's three voice actions were built, tested and wired — sitting two taps down a FAB
  menu on a voice-first product, _underneath_ the typed paths.
- The lab Vendors route existed with nothing linking to it. You had to know the URL.
- The lab inbox sat ABOVE the patient conversations, so the first thing on a screen called
  Messages was a door out of it.
- Vendor analytics were computed and locked inside a per-vendor sheet, so comparing two labs
  meant opening one, memorising it, and opening the other.
- `expectedReturnAt` has always been accepted by the API; the new-case form never offered it,
  so every rush job silently inherited the vendor's default turnaround.
- `/consultations/:id/retranscribe` and `/reextract` existed and nothing called them, while
  the failure screen re-uploaded whole recordings instead.

**The v9 frames keep being right about placement in ways the implementation was not.**

---

## Defects found by building, not by reading

These were not design gaps. They were bugs, and the migration is how they surfaced.

### A unique constraint that never constrained anything

`DoctorAvailability` declared `@@unique([doctorId, dayOfWeek, startTime, effectiveFrom])`.
`effectiveFrom` is nullable and means "always"; **every row in the database had it null**, and
Postgres treats NULLs as distinct — so the index had never applied to a single row. The seed's
`skipDuplicates` could only skip what the index called a duplicate, so every seed run appended
six more windows. The dev clinic had reached **27 identical windows per weekday**, which is
why the availability screen rendered as an unreadable wall of chips.

Fixed by a migration rebuilding the index with `NULLS NOT DISTINCT`, verified against the live
database. The application had the same hole — `create()` with no guard meant tapping Add twice
made a doctor doubly bookable.

### An SSE gap that would hang a reconnecting doctor

`GET /consultations/:id/stream` replayed the event backlog and _then_ subscribed. Every event
published between those two awaits was lost. Milliseconds wide, but the pipeline's transitions
are milliseconds apart — a doctor whose phone dropped and reconnected mid-consultation would
silently never receive `TRANSCRIBING` and would sit on a screen that never advanced.

Surfaced as an intermittent test failure that passed 3/3 in isolation. The flake was the bug
reporting itself honestly.

### The schedule was calling every appointment cancelled

Appointment cards were a translucent tinted fill, so the hour gridline behind each one showed
straight through its subtitle. Every row rendered with a line through the text — and
struck-through text in this app means cancelled.

### No-shows were invisible

The day grid filtered `NO_SHOW` out entirely, so a slot somebody was booked into and did not
attend rendered as empty space — the app telling reception nothing happened at 11:15 when in
fact someone failed to turn up. Chasing that is their job.

### Two lime + buttons, sixty pixels apart
Reception's schedule rendered its own floating `+` beside the dock's `+`. Identical buttons,
different actions: one opened the new-appointment sheet, the other navigated to Today. The
dock's orb now books the appointment on this screen, and the floating one is gone.

### One constant, defined twice, already drifted
The two schedule grids each carried their own `PX_PER_MIN` — 1.6 in one, 1.2 in the other. A
card sized in minutes by one file and positioned in minutes by another, disagreeing about how
long a minute is. It clipped the second line of every appointment in the multi-doctor view and
read as a rendering fault. Both grids now draw the same block at one exported scale, which is
also why the gridline bug only had to be fixed once.

### The billing screen asked for one day and was answered about another
`useDailyCollection` omitted the date whenever the selection matched the **browser's** today —
and the API then fell back to the **server's** today. The one case that should always work was
the only one that broke, for any client whose clock differs from the server's. It failed
silently as ₹0 collected, which on a billing screen reads as a quiet day rather than a bug.

### Half the seed moved and half did not
The capture harness pins the browser to a fixed date and `SEED_TODAY` tells the seed to fill
that day — but only appointments honoured it. Every payment, bill and lab date still measured
from the wall clock, so billing read ₹0 on a day with six appointments. The seed now has one
notion of "now" that everything relative is measured from.

### "oldest 0 days ago"
The outstanding-dues screen rendered `daysSince` raw, so a bill raised this morning read
"oldest 0 days ago" and yesterday's read "oldest 1 days ago". The kind of wrong that makes
software look unattended, on the screen you use to chase people for money. Age now reads as a
person says it — today, yesterday, 3 days, 3 weeks, 2 months — with precision falling away as
it stops mattering.

### Four red errors on an untouched form

The new-lab-case form rendered "Select a patient", "Select a vendor", "Pick a case type" and
"Select at least one tooth" the moment it opened. That tells a receptionist they have erred
before doing anything, and trains them to ignore red — the colour this app uses for **allergy
conflicts**.

### A dismiss control that only worked by accident

The x-ray viewer's Close button had no handler. It closed because the click bubbled to the
backdrop — one `stopPropagation` away from doing nothing.

### The formatter was never wired up

`packages/config/prettier.config.cjs` held this repo's style since the beginning and nothing
pointed Prettier at it. Every bare `prettier --write` fell back to defaults, so adding twenty
lines to `seed.ts` produced an **858-line diff** and broke four regression tests that assert on
source text.

### Captures had stopped working entirely

Every run bounced to `/welcome` and spent one of the five OTPs an hour the app allows, until
there were none and Gate B could not run. The cause was in the cache, not the app: the refresh
token **rotates on every use**, so the value cached at login is spent the moment the app
refreshes with it. Every run began with a dead token. The harness now lands on the splash first
(the silent refresh lives there, and a deep link skips it) and writes the rotated cookie back.

---

## Privacy and clinical decisions

Held to the rule that clinical, privacy/RBAC and PHI questions are the owner's, never inferred
from a frame.

- **Share Rx PDF is not locked** by an unresolved allergy conflict (owner ruling #91),
  consistent with #53: the warning is advisory, the dentist decides, the override is audited.
- **`findings` / `procedureNarrative` extraction fields are deferred** out of this migration
  (#52 / #90). Render the sections that have data; never generate prose to fill the rest.
- **The WhatsApp business number is masked** and the provider name removed. The card's question
  is "are we connected", not "what is the number", and it is routinely on screen when someone
  is being shown around.
- **A pending join request's name is admin-only**; everyone sees the count, because a count
  discloses nothing about who.
- **Reception surfaces do not carry clinical detail.** A medical flag in the payload is not
  permission to render it.
- **The allergy readout on intake is a readout, not a second input** — two editable copies of
  one fact is how they drift apart.

---

## Endpoints

`pnpm audit:endpoints` checks all 196 routes against every caller. The result splits three
ways, and only the first was acted on:

1. **Unwired but necessary** — `retranscribe` / `reextract`, now driving frame 26's retry.
2. **Awaiting their frame** (6) — bill PDF, appointment no-show, payment cancel, refund detail.
   Deleting these means rebuilding them; scoped to the frames that will own them.
3. **Genuinely orphaned** (5) — `inventory/expiring`, `inventory/movements/recent`,
   `lab/messages/thread`, `whatsapp-consent/audit`, `whatsapp/bulk-reminder`. **Open, awaiting
   the owner** (#130). Recommendation: drop `bulk-reminder` and `movements/recent`, keep the
   consent audit (it is the evidence of who agreed to be messaged), decide the other two
   against whether those features are wanted.

---

## Mistakes made and corrected

Recorded because they cost time and would otherwise be repeated.

- **A duplicate analytics endpoint.** Built `vendor-performance.ts` with 15 tests before
  discovering `GET /lab/vendors/:id/analytics` already existed, more richly. I had checked the
  vendor model and detail route and concluded there was nothing; I had not checked the inbox
  routes. Deleted in the same commit.
- **Broke the ledger with one field.** Filed the endpoint audit as `MUST-FIX` against
  `frames: ["*"]`. Gate B blocks a frame on any open MUST-FIX, so one repo-level finding
  knocked **all 36 completed frames** back to MISMATCHED. Caught because the count read
  `0 / 81`.
- **Removed functionality while tidying.** Deleting the `—` rows on the lab case screen took
  SKU and batch with them. Restored as a conditional line.
- **A misdiagnosis, twice.** Called the availability duplication unreal after a `DELETE 0`,
  when my own earlier dedupe had already fixed it — the query that misled me was grouping
  8,187 identically-named test clinics.
- **Parallel agents do not work on this account.** Two attempts (8 Opus, then 3 Sonnet) both
  died on account session limits within minutes, producing **zero commits**. Subagents draw on
  the same quota, so fan-out spends it faster and returns nothing.

---

## Copy changed rather than matched

Two places where a frame promises behaviour the app does not have. Both reversible — the
alternative is building the behaviour.

- **Day-off conflict note** (#112). The frame says Odovox "offers to move" conflicting
  appointments. There is no such affordance; it names the count instead.
- **WhatsApp cap footnote** (#116). The frame says sends pause at the budget cap. Whether that
  path actually halts sending is not verified end to end, and copy describing a safety
  behaviour that may not happen is worse than no copy on a screen about spending real money.

---

## Open, awaiting the owner

| #       | Question                                                                      |
| ------- | ----------------------------------------------------------------------------- |
| 130     | Five orphaned endpoints — delete, or keep?                                    |
| 135     | Day / Week / Month schedule views — no frame describes them                   |
| 120     | "Reorder all" — what does reordering mean? There is no supplier-order concept |
| 52 / 90 | `findings` / `procedureNarrative` extraction fields — deferred, not refused   |
