# Phase 5 — Acceptance Checklist

Multi-sitting treatment plans + prescription templates. 22 acceptance items mapped to automated
evidence where possible. Legend: ✅ verified by passing test / tooling · ⚠️ implemented, needs a
human eyeball (UI) · ⏭️ deferred to the real-env manual smoke.

Run all evidence at once with `pnpm verify` (types 14 · web 169 · api 307 = **490 tests**).

## Stage 1 — Multi-sitting plans

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Multi-sitting plan schema migrates cleanly | ✅ | `prisma migrate status` → up to date; `20260627170958_phase5_multisitting_plans` |
| 2 | Confirm transaction advances an existing plan when `continuesPlanId` is set | ✅ | `multisitting-confirm.test.ts` |
| 3 | Completing the final sitting marks the plan COMPLETED | ✅ | `multisitting-completes-plan.test.ts` |
| 4 | SITTING_GAP / overflow safety flag on suspicious sitting numbers | ✅ | `multisitting-safety-gap.test.ts`, `safety-sitting-overflow.test.ts` |
| 5 | PLAN_PATIENT_MISMATCH blocks a plan id belonging to another patient | ✅ | `multisitting-cross-patient.test.ts` |
| 6 | Sitting overflow (current > total) is surfaced, not silently committed | ✅ | `multisitting-overflow.test.ts` |
| 7 | Cross-clinic plan continuation is rejected | ✅ | `multisitting-cross-clinic.test.ts` |
| 8 | Clinical prompt embeds ACTIVE plans + never-assume continuation rules | ✅ | `multisitting-extraction.test.ts` |

## Stage 2 — Prescription templates

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 9 | PrescriptionTemplate schema migrates cleanly | ✅ | `20260627222203_phase5_prescription_templates` |
| 10 | Template CRUD routes (create / list / update / archive) | ✅ | `template-crud.test.ts`; registered in `server.ts:85` |
| 11 | 5 starter templates seeded | ✅ | `template-seed.test.ts` |
| 12 | Template management is RBAC-gated | ✅ | `template-rbac.test.ts` |
| 13 | Templates are isolated per clinic | ✅ | `template-cross-clinic.test.ts` |
| 14 | Archiving a template preserves prior prescription history | ✅ | `template-archive-preserves-history.test.ts` |
| 15 | Using a template increments its usage counter | ✅ | `template-use-increments-usage.test.ts` |

## Stage 3 — Template integration

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 16 | Voice dictation resolves "apply &lt;template&gt;" → `applyTemplateId` | ✅ | `template-dictation.test.ts` |
| 17 | Prescription sheet shows a template picker | ⚠️ | `clinic/templates/page.tsx`; verify in browser |

## Stage 4 — Plan detail / cancel / PDF

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 18 | Plan detail page renders the plan + its sittings | ✅ / ⚠️ | `plan-detail.test.ts`; `patients/[id]/plans/[planId]/page.tsx` |
| 19 | Plan cancel with RBAC + audit log | ✅ | `plan-cancel.test.ts`, `plan-cancel-rbac.test.ts` |
| 20 | Plan detail is cross-clinic isolated | ✅ | `plan-detail-cross-clinic.test.ts` |
| 21 | Treatment-plan PDF generates | ✅ | `plan-pdf-gen.test.ts`; `lib/treatment-plan-pdf.ts` |
| 22 | Cases tab active-plan emphasis + tooth-map sage dots | ⚠️ | `odontogram.tsx`, `patients/[id]/page.tsx`; verify in browser |

## Stage 5 — Clinical hardening (added scope)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| + | Clinical prompt hardened to v3 + 20 dictation fixtures | ✅ | `clinical-fixtures.test.ts` (26 tests) |

## Stage 6 — Real-env smoke (manual, human-at-mic)

⏭️ Requires the dev stack running with real provider keys (Sarvam + Gemini both SET; OTP mock).
Cannot be automated — needs spoken audio in the browser. Procedure:

1. `pnpm dev` (api + web). Confirm the boot banner shows masked keys + `gemini-2.5-flash`.
2. **Three multi-sitting consultations** on the same patient + tooth:
   - Sitting 1: "Starting RCT on 26, first sitting." → new plan, 1/?.
   - Sitting 2: "Continuing the RCT on 26, second sitting." → continues the same plan.
   - Sitting 3 (final): "RCT on 26 completed, final sitting." → plan flips COMPLETED.
   - Verify the plan detail page reflects each step and the tooth-map dot turns sage.
3. **Template dictation**: in the prescription flow say "apply RCT pack". → the RCT-pack medicines
   populate from the template; usage counter increments.

Record the transcripts + extracted JSON here once run.
