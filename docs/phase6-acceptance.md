# Phase 6 — Schedule & Appointments · Acceptance

Status at tag `phase-6`. Test suite: **582 total** (Phase 5 ended at 490 → **+92 new**, target ≥45).
`pnpm verify` green (lint + typecheck + test across api/web/types/db).

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | `pnpm verify` passes (~535+, ≥45 new) | ✅ | 582 tests (api 375 · web 193 · types 14) |
| 2 | Migration applies + seed adds availability | ✅ | `phase6_schedule_appointments` via `migrate deploy` (trigram indexes preserved); seed `doctorAvailability.createMany` |
| 3 | Doctor `/schedule` day view (hour rows, lunch, now-line) | ✅ | `DayView` · screenshot 1 · `day-layout.test.ts` |
| 4 | Receptionist parallel doctor columns | ✅ | `MultiDoctorDay` · screenshot 2 · `multi-doctor.test.ts` |
| 5 | Week strip navigation | ✅ | `WeekStrip` · `week-strip.test.ts` |
| 6 | New appointment — slot picker + inline conflicts | ✅ | `NewAppointmentSheet`/`SlotPicker` · screenshot 3 · `conflict-view.test.ts` |
| 7 | Hard conflict → 409, cannot save | ✅ | `apt-create-doctor/room-double-book` |
| 8 | Soft conflict → warn + acknowledge | ✅ | `apt-create-soft-conflict-(no-ack|acked)` |
| 9 | Reschedule sets originalStartsAt, count, audit, reminders rebooked | ✅ | `reschedule` + `reschedule-cancels-old-reminders` |
| 10 | Cancel with reason → CANCELLED, audit, reminders cancelled | ✅ | `cancels with a reason and writes audit` |
| 11 | Recurring 4 weekly, shared seriesId, indexes 1–4 | ✅ | `creates a 4-occurrence weekly series` |
| 12 | "Cancel this and future" keeps prior intact | ✅ | `cancels "this and future"` |
| 13 | NO_SHOW cron marks past-due after grace (fake clock) | ✅ | `no-show-cron.test.ts` (4) |
| 14 | Voice followUp finds first available slot | ✅ | `voice-followup` finds a real slot |
| 15 | Voice followUp no slot → safety warning | ✅ | `voice-followup` NO_AVAILABLE_SLOT |
| 16 | Verification card shows resolved date + "Auto-scheduled" hint | ⚠️ Partial | Server resolves the slot + surfaces `NO_AVAILABLE_SLOT` on the consultation; the **pre-confirm card hint** is deferred (needs a slot-preview call — see Deviations) |
| 17 | Multi-sitting "Schedule remaining" interval picker → series tied to plan | ✅ | `ScheduleRemaining` card on plan detail → `/appointments/recurring` w/ `treatmentPlanId` · `multisitting-schedule` tests |
| 18 | Cancelling a plan auto-cancels its SCHEDULED appointments | ✅ | `multisitting-cancellation-cascades-to-appointments` |
| 19 | Availability page sets working hours, reflected in slots | ✅ | `/clinic/availability` · `editing availability does NOT cascade-cancel` |
| 20 | Day-off creation blocks slot generation | ✅ | `/clinic/day-off` · `admin creates a clinic day-off and it blocks slots` |
| 21 | Day-off with existing appts → 409 with list | ✅ | `refuses to create a day-off when appointments exist (409)` |
| 22 | Realtime: create → other calendars update | ✅ | `apt-create-broadcasts-after-commit` + `useScheduleRealtime` (invalidate on `schedule.appointment.*`) |
| 23 | Cross-clinic isolation tested | ✅ | `cross-clinic` cancel 404 + patient-appointments isolation; new models in `CLINIC_SCOPED_MODELS` |
| 24 | RBAC matrix enforced, 403 + audit | ✅ | `forbids doctor booking another queue`, `receptionist can't set availability` |
| 25 | §12.1 compliance (no mesh/mascot on /schedule, glass on modals) | ✅ | `bg-paper` page, sheets only; regression suite green |
| 26 | Mobile 390×844 renders | ✅ | All 4 screenshots captured at 390×844 |

## Screenshots (`docs/phase6-screenshots/`)
1. `1-doctor-day-view.png` — doctor day with week strip, tone-coloured blocks, lunch band, FAB
2. `2-receptionist-multi-doctor.png` — parallel Asha/Vikram columns
3. `3-new-appointment-sheet.png` — patient/date/duration + live availability slots
4. `4-appointment-detail.png` — detail with Check in / Reschedule / Cancel

Regenerate: `node scripts/phase6-screenshots.mjs` (API :4000 + web :3000 + seeded DB).

## Real-env smoke (performed)
- Booked appointments for two doctors on a working day via the live API; the second attempt
  correctly returned `409 DOCTOR_DOUBLE_BOOKED` (server-side conflict gate working).
- New-appointment slot picker showed availability-aware slots (morning slots correctly excluded
  once booked).
- NO_SHOW sweep validated with a fake clock (`runNoShowSweep`) in `no-show-cron.test.ts`.
- Voice follow-up auto-scheduling validated end-to-end via the confirm route (`voice-followup.test.ts`).

## Deviations
1. **Appointment field rename** `scheduledAt→startsAt`(+`endsAt`), `procedureType→procedureHint`,
   enum `CONFIRMED→CHECKED_IN`, and `DoctorAvailability` repurposed from a per-date exception model
   to a recurring weekly template (+ new `DayOff`). Approved up front; the plan's "already exists"
   framing didn't match the schema. Legacy `CONFIRMED` rows migrated to `SCHEDULED`.
2. **Admin via `isAdmin`**, not a token role — no `ADMIN` role token exists in this system (the
   clinic creator is role `DOCTOR` + `isAdmin`). Admin-gated endpoints resolve admin via a
   membership lookup.
3. **Drag-drop reschedule deferred** — reschedule is via the detail sheet's date+slot picker, and
   tap-to-book (per doctor column) covers creation. Functionally complete for the phase; true
   pointer drag is post-MVP polish.
4. **Verification-card pre-confirm auto-schedule hint (#16) deferred** — the auto-schedule resolution
   and `NO_AVAILABLE_SLOT` warning are fully wired server-side and surface on the consultation; the
   card's pre-confirm "resolved date" preview needs a client slot-preview call and is deferred.
