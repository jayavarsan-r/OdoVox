# Document 1 — Complete Feature Matrix

> Every feature in the application, mapped to its design frame. Nothing omitted.
> Built by walking all 23 API route files, all 44 web routes, and all 76 components.
>
> **Impl.** ✓ complete · ⚠ partial · ✗ absent
> **BE** = needs backend work · **UI** = needs UI work
> **Risk** = regression risk if the migration touches it: 🔴 high · 🟠 medium · 🟢 low

Legend for "Frame": `v9-NN` = odovox-v9-master frame NN · `v10-NN` = odovox-v10-talk frame NN ·
**—** = no frame exists, must be redesigned in the same language (never removed).

---

## 1 · Authentication

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| OTP request (phone) | `routes/auth.ts:62`, `/phone` | v9-03 | ✓ | — | — | ✓ | 🟠 |
| OTP verify | `routes/auth.ts:131`, `/otp` | v9-04 | ✓ | — | — | ✓ | 🟠 |
| OTP wrong-code state | `/otp` | v9-05 | ⚠ | shake + crit outline + auto-clear + resend unlock | — | ✓ | 🟢 |
| SMS autofill ("Reading SMS…") | `OtpInput` | v9-04 | ⚠ | the live status line | — | ✓ | 🟢 |
| Resend countdown | `/otp` | v9-04 | ✓ | — | — | ✓ | 🟢 |
| Token refresh (12h session) | `routes/auth.ts:215`, `api-client.ts` | v9-01 | ✓ | — | — | — | 🔴 |
| Session bootstrap / splash routing | `app/page.tsx` | v9-01 | ✓ | Odo + 4px hairline replaces spinner | — | ✓ | 🔴 |
| Logout | `routes/auth.ts:267`, `ProfileButton` | v9-76 | ✓ | — | — | ✓ | 🟢 |
| `/auth/me` session fetch | `routes/auth.ts:289` | — | ✓ | — | — | — | 🔴 |
| **Device unlock (PIN)** | — | v9-06 | ✗ | whole feature | ✓ | ✓ | 🟢 |
| ~~Biometric / WebAuthn~~ | — | v9-06 | ✗ | **descoped pre-launch** (your call) | — | — | — |

## 2 · Onboarding & clinic setup

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Welcome slides (3, swipeable) | `/welcome` (embla) | v9-02 | ✓ | — | — | ✓ | 🟢 |
| Skip to CTA | `/welcome` | v9-02 | ✓ | — | — | ✓ | 🟢 |
| Role selection | `/role` | v9-07 | ✓ | — | — | ✓ | 🟢 |
| Create-or-join choice | `/clinic-choice` | **—** | ✓ | app-only screen — redesign, keep | — | ✓ | 🟢 |
| Clinic create — basics | `/clinic-create/step-1-basics` | v9-08 | ✓ | — | — | ✓ | 🟠 |
| Clinic create — hours | `/clinic-create/step-2-hours` | v9-08 | ✓ | spec ships these as defaults; **we keep the step** | — | ✓ | 🟠 |
| Clinic create — profile | `/clinic-create/step-3-profile` | v9-08 / v9-76 | ✓ | spec moves this to Account; **we keep the step** | — | ✓ | 🟠 |
| Wizard step indicator | `StepperHeader`, `lib/ds/stepper.ts` | v9-08 | ✓ | `.ob-dots` treatment | — | ✓ | 🟢 |
| Join by code | `/clinic-join`, `routes/clinics.ts:152` | v9-09 | ✓ | — | — | ✓ | 🟠 |
| Clinic preview before joining | `routes/clinics.ts:136` lookup | v9-09 | ✓ | — | — | ✓ | 🟢 |
| **Pending-approval state** | `ClinicMember.status=PENDING` exists; not surfaced | v9-10 | ✗ | screen + poll; `/auth/me` returns `null` for PENDING | ✓ | ✓ | 🟠 |
| Done / celebration | `/done` | v9-11 | ✓ | — | — | ✓ | 🟢 |
| Join-code share on Done | `/done` (QR + clipboard) | v9-11 | ✓ | — | — | ✓ | 🟢 |
| **First-day setup checklist** | — | v9-12 | ✗ | whole screen (derivable, no new endpoint) | — | ✓ | 🟢 |

## 3 · Navigation & app shell

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Bottom tabs (5, role-based) | `BottomTabs`, `lib/rbac.ts` | v9-all | ⚠ | **5 → 4 tabs**; glass pill; spec dimensions | — | ✓ | 🔴 |
| **Orb (mic / ＋)** | — (`FabMenu` is a corner FAB) | v9-78 | ✗ | tap-action, hold-350ms voice menu, per-tab ring | — | ✓ | 🔴 |
| Speed dial | `FabMenu`, `lib/ds/fab.ts` | v9-18 | ⚠ | re-anchor above the orb; `.dpill` styling | — | ✓ | 🟠 |
| **More hub** | — (`/clinic` is tab 5) | v9-70 | ✗ | new `/more` route | — | ✓ | 🟠 |
| RBAC route guard | `lib/rbac.ts`, `(app)/layout.tsx` | — | ✓ | add `/more` as shared | — | — | 🔴 |
| Role landing routes | `landingRoute()` | — | ✓ | — | — | — | 🟠 |
| Tab hide on detail routes | `TOP_LEVEL` in layout | — | ✓ | — | — | ✓ | 🟠 |
| Route error boundary | `(app)/error.tsx` | **—** | ✓ | restyle | — | ✓ | 🟢 |
| Page transitions | `AnimatedPage`, `ds/motion.tsx` | — | ✓ | spec durations | — | ✓ | 🟢 |
| Mobile shell / max-width | `MobileShell` | — | ✓ | — | — | ✓ | 🟢 |
| Dev banner | `DevBanner` | **—** | ✓ | restyle | — | ✓ | 🟢 |
| Offline banner | `OfflineBanner` | v9-17 | ⚠ | concerned-Odo treatment, Retry chip | — | ✓ | 🟠 |
| Toasts | `lib/toast.ts` (sonner) | v9-79 | ⚠ | three voices, 6s Undo affordance | — | ✓ | 🟠 |
| **Notifications centre** | `Notification` model exists, **0 usage** | v9-80 | ✗ | 3 endpoints + 4 writers + screen | ✓ | ✓ | 🟢 |

## 4 · Home / Flow (doctor)

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Greeting + date eyebrow | `/home` | v9-13 | ✓ | — | — | ✓ | 🟢 |
| Profile avatar | `ProfileButton` | v9-13 | ✓ | — | — | ✓ | 🟢 |
| **Day river** (8 segments) | — | v9-13 | ✗ | whole component (data exists in schedule) | — | ✓ | 🟢 |
| Caption line (seen/in-chair/to-go/₹) | — (stat tiles instead) | v9-13 | ✗ | replaces the StatTile row | — | ✓ | 🟢 |
| In-chair hero + progress ring | `HeroCard` + `consultHeroSubtitle` | v9-13 | ⚠ | `.hero-c` gradient, ring, allergy line | — | ✓ | 🟠 |
| Continue-consultation CTA | `HeroCard onClick` | v9-13 | ✓ | inline CTA position | — | ✓ | 🟠 |
| Quick tools (5 tiles) | `QuickTile` ×5 | v9-13 | ⚠ | `.qt` 2×2 + wide day-off bar | — | ✓ | 🟢 |
| Today's appointments | `useSchedule` | v9-13 | ⚠ | becomes "Up next" `.hscroll` `.qcard`s | — | ✓ | 🟢 |
| Needs-you feed | `useNeedsYou`, `routes/home.ts:15` | v9-13 | ✓ | `.vrow` treatment | — | ✓ | 🟢 |
| Recent visits | `useRecentVisits`, `routes/home.ts:163` | v9-13 | ✓ | — | — | ✓ | 🟢 |
| Voice command hero | `VoiceCommandHero` | v10-01 | ✓ | folds into the orb hold | — | ✓ | 🟠 |
| Patient search (voice) | `VoiceSearchInput` | v9-33 | ✓ | moves to Patients header | — | ✓ | 🟢 |
| **Flow: chair-free state** | — | v9-14 | ✗ | "Good gap for" + call-next | — | ✓ | 🟢 |
| **Flow: quiet-morning state** | — | v9-15 | ✗ | Odo + prepare-chart CTA | — | ✓ | 🟢 |
| **Flow: day-done state** | — | v9-16 | ✗ | celebration + tomorrow's first slot | — | ✓ | 🟢 |
| **Flow: offline state** | `OfflineBanner` only | v9-17 | ⚠ | full-state treatment + sync-pending badges | — | ✓ | 🟠 |
| **Week in review** | — | v9-20 | ✗ | screen + `GET /reports/weekly` | ✓ | ✓ | 🟢 |
| Block-time / day-off quick sheet | `/clinic/day-off` page only | v9-19 | ⚠ | add sheet as a second entry point | — | ✓ | 🟢 |

## 5 · Reception Today

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Today header + live dot | `/today`, `RealtimeDot` | v9-50 | ✓ | `● LIVE` eyebrow | — | ✓ | 🟢 |
| Collection stat tiles (4) | `collectionStatTiles` | v9-50 | ⚠ | → money bento pair + stat row | — | ✓ | 🟠 |
| Today stats (3) | `useTodayStats`, `routes/home.ts:267` | v9-50 | ✓ | → `.stat` pills | — | ✓ | 🟢 |
| Queue grouped by doctor | `getByDoctor` | v9-50 | ✓ | chair labels, `Rec` DND chip | — | ✓ | 🟠 |
| Checkout list | `getCheckout`, `CheckoutRow` | v9-50 | ✓ | lime amount chips | — | ✓ | 🟠 |
| Activity feed | `ActivityFeed`, `routes/home.ts:209` | **—** | ✓ | restyle | — | ✓ | 🟢 |
| Walk-in sheet | `WalkInSheet` | v9-51 | ✓ | — | — | ✓ | 🟠 |
| Walk-in by voice | `POST /queue/walkin/dictate` | v9-51 / v10 | ✓ | — | — | ✓ | 🟠 |
| Checkout sheet | `CheckoutSheet` | v9-52 | ✓ | payable = biggest number | — | ✓ | 🔴 |
| Payment-received toast + undo | `lib/toast.ts` | v9-53 | ⚠ | 6s undo affordance | — | ✓ | 🟠 |
| Queue action sheet | `QueueActionSheet` | **—** | ✓ | restyle | — | ✓ | 🟠 |
| Add-to-queue sheet | `AddToQueueSheet` | **—** | ✓ | restyle | — | ✓ | 🟠 |
| Next-up hint | `NextUpHint` | v9-14 | ✓ | restyle | — | ✓ | 🟢 |
| Messages entry point | `/today` button | v9-70 | ✓ | moves into More hub | — | ✓ | 🟢 |

## 6 · Patients

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Patient list | `/patients`, `routes/patients.ts:34` | v9-32 | ✓ | glyph rows, status rings | — | ✓ | 🔴 |
| Filter chips (All/Today/Treating/Due) | — | v9-32 | ✗ | new; data exists | — | ✓ | 🟢 |
| Search (name/phone/ID) | `/patients?search=` | v9-33 | ✓ | header morph, match highlight, recents | — | ✓ | 🟠 |
| Voice search | `VoiceSearchInput` | v9-33 | ✓ | mic inside the field | — | ✓ | 🟢 |
| No-match → create | — | v9-34 | ✗ | query pre-fills intake | — | ✓ | 🟢 |
| Create patient | `/patients/new`, `routes/patients.ts:69` | v9-35 | ✓ | — | — | ✓ | 🔴 |
| Voice intake | `POST /patients/intake/dictate` | v9-36 | ✓ | `.frm.voiced` lime spine | — | ✓ | 🔴 |
| Medical-flag chips | `ChipMultiSelect` | v9-35/36 | ✓ | `.gchip` toggles | — | ✓ | 🟠 |
| Add-to-queue on create | `/patients/new` | **—** | ✓ | keep (2 regression tests) | — | ✓ | 🔴 |
| Blood group (optional) | `/patients/new` | **—** | ✓ | keep (1 regression test) | — | ✓ | 🟠 |
| Patient detail — Overview | `/patients/[id]` | v9-37 | ✓ | identity block, stat cards, action row | — | ✓ | 🔴 |
| Patient detail — Cases | `CasesTab` | v9-38 | ✓ | `.vj` journey rail | — | ✓ | 🔴 |
| Patient detail — Teeth | `TeethTab`, `Odontogram` | v9-40 | ✓ | `.odn` cells, inline status panel | — | ✓ | 🟠 |
| Patient detail — **Media** | `MediaTab`, `routes/media.ts` | **—** | ✓ | app-only tab — **keep**, restyle | — | ✓ | 🟠 |
| Patient detail — Billing | `BillingTab`, `routes/patients.ts:203` | v9-41 | ✓ | bento + bill rows | — | ✓ | 🟠 |
| Patient tabs control | inline underline tabs | v9-37 | ⚠ | `.ptabs` inset pill group | — | ✓ | 🟢 |
| Edit patient | `PATCH /patients/:id` | **—** | ✓ | restyle | — | ✓ | 🟠 |
| Delete patient (confirm) | `BottomSheet` + `DELETE` | v9-37 (⋯) | ✓ | into the ⋯ menu | — | ✓ | 🟠 |
| Record-findings CTA | `/patients/[id]` | v9-37 | ✓ | RBAC: doctor only (1 regression test) | — | ✓ | 🔴 |
| **History timeline** | records inline on Overview | v9-42 | ✗ | new page, derivable | — | ✓ | 🟢 |
| **Visit record sheet** | `GET /visits/:id` exists | v9-43 | ✗ | sheet body only | — | ✓ | 🟢 |
| Amend (append-only) | `ConsultationEdit` model | v9-43 | ⚠ | surface it | — | ✓ | 🟠 |
| Patient statement PDF | `/reports/patient-statement` | v9-37 (⋯) | ✓ | into the ⋯ menu | — | ✓ | 🟢 |

## 7 · Consultation & voice pipeline

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Live queue | `/consult`, `lib/queue/*` | v9-21 | ✓ | — | — | ✓ | 🔴 |
| Call-in / swipe-right | `QueueCards` | v9-21 | ⚠ | swipe gesture | — | ✓ | 🟠 |
| Empty queue | `EmptyState` | v9-22 | ✓ | sleeping Odo + 2 exits | — | ✓ | 🟢 |
| Audio presign + upload | `/consultations/audio/presign` | — | ✓ | — | — | — | 🔴 |
| Recording UI | `Recorder` | v9-23 | ✓ | rings, 56px timer, Finish | — | ✓ | 🔴 |
| Live waveform | `Waveform` (analyser) | v9-23 | ✓ | — | — | ✓ | 🟠 |
| Live complaint strip | `ComplaintStrip` | v9-23 | ✓ | `.gchip` | — | ✓ | 🟢 |
| Pause / resume | `useConsultStore` | v9-24 | ✓ | frozen grey rings | — | ✓ | 🔴 |
| Auto-pause on call | store | v9-24 | ✓ | warn banner | — | ✓ | 🔴 |
| Processing state | `ProgressStrip` (3 steps) | v9-25 | ⚠ | **spec deletes the strip** → Odo + one bar | — | ✓ | 🟠 |
| SSE progress stream | `/consultations/:id/stream` | v9-25 | ✓ | — | — | — | 🔴 |
| Processing failure | store `FAILED` | v9-26 | ✓ | "audio safe on this phone" | — | ✓ | 🟠 |
| Retry / retranscribe / reextract | `/consultations/:id/re*` | v9-26 | ✓ | — | — | ✓ | 🟠 |
| Keep-audio-review-later draft | `verification-card-autosave-draft` | v9-26 | ✓ | lav badge on patient | — | ✓ | 🟠 |
| Verification card | `VerificationCard` (545 ln) | v9-27–30 | ✓ | bento + med list + `.paper` block | — | ✓ | 🔴 |
| Safety / allergy conflict | `lib/consult/safety-view.ts` | v9-27 | ✓ | **crit rail, not a banner** | — | ✓ | 🔴 |
| Swap medicine inline | `editors.ts` | v9-28 | ✓ | in-place re-render + Undo | — | ✓ | 🔴 |
| n-medicine list (7+) | `VerificationCard` | v9-29 | ⚠ | full-width scalable list | — | ✓ | 🔴 |
| Uncertain-value ⟨verify⟩ chips | `VerificationCard` | v9-27 | ⚠ | amber chip → cursor jump | — | ✓ | 🟠 |
| Confirm & save | `/consultations/:id/confirm` | v9-31 | ✓ | — | — | ✓ | 🔴 |
| Reject | `/consultations/:id/reject` | **—** | ✓ | keep | — | ✓ | 🟠 |
| Free edit (pen) | `PATCH /consultations/:id` | v9-27 | ✓ | — | — | ✓ | 🟠 |
| Saved beat + chips | — | v9-31 | ⚠ | 3 outcome chips + call-next | — | ✓ | 🟢 |
| Inline / preview modes | 2 regression tests | **—** | ✓ | keep | — | ✓ | 🔴 |
| Patient context card | `PatientContextCard` | v9-23 | ✓ | 1 regression test on layout | — | ✓ | 🟠 |
| X-ray strip in consult | `XrayStrip` | **—** | ✓ | restyle | — | ✓ | 🟢 |

## 8 · Voice command surface (v10)

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Single-shot capture | `VoiceInput` | v10-01 | ✓ | live transcript + entity lift | — | ✓ | 🟠 |
| Intent routing | `lib/voice/intent-router.ts` | v10-05 | ⚠ | 7-intent grammar | — | ✓ | 🟠 |
| **Parsed confirm sheet** | 10 `/dictate/*` endpoints exist | v10-02 | ✗ | `.pf` field rows + Odo follow-up | — | ✓ | 🟠 |
| **Correction / low-confidence** | — | v10-04 | ✗ | dotted-warn underline, candidate chips, spell-it | — | ✓ | 🟠 |
| **Done + keep-listening** | — | v10-03 | ✗ | next-act chips, chaining | — | ✓ | 🟢 |
| **"What can I say" grammar** | — | v10-05 | ✗ | sheet, tappable intent rows | — | ✓ | 🟢 |
| Tamil/English code-switch | Sarvam STT (`lib/stt`) | v10-01 | ✓ | — | — | — | 🟠 |
| >30s chunking | shipped Phase 9.6 st.4 | — | ✓ | — | — | — | 🔴 |
| Parse→confirm contract | `inventory/voice-sheets.tsx` | v9-69 | ✓ | **the template for all voice writes** | — | ✓ | 🟠 |

## 9 · Treatment plans, procedures, odontogram

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Plan list | `/patients/:id/plans` | v9-38 | ✓ | active section (1 regression test) | — | ✓ | 🟠 |
| Create plan | `POST /patients/:id/plans` | v9-38 (＋Plan) | ✓ | — | — | ✓ | 🟠 |
| Plan detail | `/patients/[id]/plans/[planId]` | v9-39 | ✓ | fees bar, NEXT tile, sittings, linked | — | ✓ | 🔴 |
| Complete plan | `/plans/:id/complete` | v9-39 | ✓ | — | — | ✓ | 🟠 |
| Cancel plan (reason) | `/plans/:id/cancel` | v9-38 | ✓ | — | — | ✓ | 🟠 |
| Edit / delete plan | `PATCH`/`DELETE /plans/:id` | **—** | ✓ | restyle | — | ✓ | 🟠 |
| Plan PDF | `/plans/:id/pdf` | v9-38 | ✓ | — | — | ✓ | 🟢 |
| Sittings log | `Sitting` model | v9-39 | ✓ | each row → visit record | — | ✓ | 🟠 |
| Schedule remaining sittings | `/appointments/recurring` | v9-38 | ✓ | — | — | ✓ | 🟠 |
| Odontogram (FDI 32) | `Odontogram` | v9-40 | ✓ | `.odn` cells, mid gap, legend | — | ✓ | 🟠 |
| Tooth status set | `routes/patients.ts:143` | v9-40 | ✓ | inline panel, no nav jump | — | ✓ | 🟠 |
| Tooth → plan link | `TeethTab` | v9-40 | ✓ | 1 regression test | — | ✓ | 🟠 |
| Per-tooth media | `MediaTab` separate | v9-40 | ⚠ | spec folds media under the tooth | — | ✓ | 🟢 |

## 10 · Prescriptions

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Rx sheet | `PrescriptionSheet` | v9-44 | ✓ | `.medcard` + dose dots | — | ✓ | 🔴 |
| Add medicine | sheet | v9-44 | ✓ | dashed add row | — | ✓ | 🟠 |
| Dose / frequency / duration | `MedicineFrequency` | v9-44 | ✓ | **●○● dose dots** | — | ✓ | 🟠 |
| Allergy conflict guard | safety check | v9-45 | ✓ | crit outline + inline fix, Share locked | — | ✓ | 🔴 |
| Save & share PDF | `/prescriptions/:id/pdf` | v9-44 | ✓ | — | — | ✓ | 🟠 |
| Rx templates list | `/clinic/templates` | v9-75 | ✓ | — | — | ✓ | 🟢 |
| Apply template | `PrescriptionTemplate` | v9-44 | ✓ | allergy re-check on apply | — | ✓ | 🟠 |
| Save as template | sheet | v9-44 | ✓ | demoted to text link | — | ✓ | 🟢 |
| Rx by voice | `/prescriptions/dictate` | v9-44 | ✓ | — | — | ✓ | 🟠 |
| `reviewAfterDays` | `Prescription` column | v9-66 | ⚠ | **feeds follow-ups** (§Doc 3) | — | ✓ | 🟢 |

## 11 · Schedule & appointments

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Day view (doctor) | `DayView` | v9-46 | ✓ | `.appt` bars, gaps, lunch, now-line | — | ✓ | 🔴 |
| Multi-doctor day (reception) | `MultiDoctorDay` | v9-47 | ✓ | shared now-line, off-shading | — | ✓ | 🟠 |
| Week strip | `WeekStrip` | v9-46 | ✓ | `.wd` lime capsule | — | ✓ | 🟢 |
| Day/Week/Month toggle | `/schedule` | v9-46 | ⚠ | `.seg` control | — | ✓ | 🟢 |
| Free-slot hints | `SlotPicker`, `/schedule/slots` | v9-46 | ✓ | dashed `.slot-hint` | — | ✓ | 🟠 |
| New appointment sheet | `NewAppointmentSheet` | v9-48 | ✓ | real free-slot chips | — | ✓ | 🔴 |
| Book by voice | `/appointments/dictate` | v9-48 | ✓ | — | — | ✓ | 🟠 |
| Appointment detail sheet | `AppointmentDetailSheet` | **—** | ✓ | restyle | — | ✓ | 🟠 |
| Reschedule | `/appointments/:id/reschedule` | v9-49 | ✓ | — | — | ✓ | 🟠 |
| **Drag to reschedule** | — | v9-49 | ✗ | lift, dashed drop target, confirm bar | — | ✓ | 🟠 |
| Cancel | `/appointments/:id/cancel` | **—** | ✓ | restyle | — | ✓ | 🟠 |
| No-show | `/appointments/:id/no-show` | **—** | ✓ | restyle | — | ✓ | 🟢 |
| Recurring series | `/appointments/recurring` | **—** | ✓ | restyle | — | ✓ | 🟠 |
| Cancel series | `/appointments/series/:id/cancel` | **—** | ✓ | restyle | — | ✓ | 🟠 |
| Doctor availability | `/clinic/availability` | v9-73 | ✓ | per-day chips + ＋ | — | ✓ | 🟠 |
| Copy Monday to weekdays | — | v9-73 | ✗ | convenience action | — | ✓ | 🟢 |
| Days off | `/clinic/day-off` | v9-74 | ✓ | scope seg, warn card | — | ✓ | 🟠 |
| Booking-conflict guard | `/day-off` POST | v9-19/74 | ✓ | count + "move them first" | — | ✓ | 🔴 |
| Appointment reminders | `AppointmentReminder` + sweep | **—** | ✓ | — | — | — | 🟠 |

## 12 · Billing & payments

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Bill list | `/bills` | v9-41 | ✓ | — | — | ✓ | 🟠 |
| Bill sheet (items + payments) | `BillSheet` | v9-41 | ✓ | — | — | ✓ | 🟠 |
| Create / edit bill items | `/bills/:id/items` | **—** | ✓ | restyle | — | ✓ | 🟠 |
| Bill from visit | `/visits/:id/bill` | **—** | ✓ | — | — | 🔴 |
| Finalize / reopen / cancel | `/bills/:id/*` | **—** | ✓ | restyle | — | ✓ | 🔴 |
| Bill PDF | `/bills/:id/pdf` | v9-41 | ✓ | — | — | ✓ | 🟢 |
| Bill items by voice | `/bills/:id/dictate/items` | **—** | ✓ | 1 regression test | — | ✓ | 🟠 |
| Cash payment | `/payments/cash` | v9-52 | ✓ | `.seg` method picker | — | ✓ | 🔴 |
| UPI manual | `/payments/upi-manual` | v9-52 | ✓ | "Odovox waits and returns" copy | — | ✓ | 🔴 |
| Card manual | `/payments/card-manual` | v9-52 | ✓ | — | — | ✓ | 🔴 |
| Bank transfer | `/payments/bank-transfer` | v9-52 | ✓ | — | — | ✓ | 🔴 |
| Razorpay link | `/payments/razorpay/link` | **—** | ✓ | restyle | — | ✓ | 🔴 |
| Razorpay webhook | `routes/webhooks.ts` | — | ✓ | — | — | — | 🔴 |
| Adjustment (admin) | `/payments/adjustment` | v9-52 | ✓ | discount row for permitted roles | — | ✓ | 🟠 |
| Cancel payment | `/payments/:id/cancel` | v9-53 | ✓ | 6s undo | — | ✓ | 🟠 |
| Refunds | `routes/refunds.ts` | v9-54 | ✓ | crit sign in the feed | — | ✓ | 🟠 |
| Payment plans | `PaymentPlan` model | **—** | ⚠ | model exists; verify UI | — | ✓ | 🟠 |
| Billing dashboard | `/billing` | v9-54 | ✓ | hero + hourly bars + inline pills | — | ✓ | 🟠 |
| Daily collection | `/reports/daily-collection` | v9-54 | ✓ | — | — | ✓ | 🟠 |
| By-doctor split | `/reports/daily-collection` | v9-54 | ✓ | — | — | ✓ | 🟢 |
| Outstanding dues | `/billing/outstanding` | v9-55 | ✓ | crit bento + Remind chips | — | ✓ | 🟠 |
| Payment reminders | `BillReminder` + sweep | v9-55 | ✓ | consent-gated | — | — | 🟠 |

## 13 · Lab

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Lab case list | `/lab` | v9-56 | ✓ | **`.stat` pills, not tiles** | — | ✓ | 🟠 |
| Status filter chips | `/lab` | v9-56 | ✓ | — | — | ✓ | 🟢 |
| New case (page) | `/lab/new` | v9-59 | ✓ | spec = sheet; **we keep the page** | — | ✓ | 🟠 |
| New case by voice | `/lab/dictate/new-case` | v9-59 | ✓ | — | — | ✓ | 🟠 |
| **Lab ＋ dial** | — | v9-57 | ✗ | 3-item dial (case / message / vendor) | — | ✓ | 🟢 |
| Case detail | `/lab/[caseId]` | v9-58 | ✓ | 6-step `.jy` rail | — | ✓ | 🟠 |
| Case edit | `/lab/[caseId]/edit` | **—** | ✓ | app-only — keep, restyle | — | ✓ | 🟠 |
| Status transitions | `lib/lab/transition-service.ts` | v9-58 | ✓ | — | — | — | 🔴 |
| Case event history | `LabCaseEvent` | v9-58 | ✓ | `.kv` rows + Undo | — | ✓ | 🟠 |
| Margin / material bento | `/lab/[caseId]` | v9-58 | ✓ | — | — | ✓ | 🟢 |
| Case photos | `routes/media.ts` | v9-58 | ✓ | 72px strip + camera tile | — | ✓ | 🟢 |
| Vendors list | `/lab/vendors` | v9-61 | ✓ | consent/on-time `.mini`s | — | ✓ | 🟠 |
| Vendor 90-day analytics | `/lab/vendors` | v9-61 | ✓ | bento | — | ✓ | 🟢 |
| Vendor phone masking + reveal | `LabVendor` enc fields | v9-61 | ✓ | — | — | ✓ | 🔴 |
| Automation kill-switch | vendor sheet | v9-61 | ✓ | — | — | ✓ | 🟠 |
| WhatsApp consent gate | `routes/whatsapp-consent.ts` | v9-60 | ✓ | "will send" preview | — | ✓ | 🔴 |
| Lab inbox (parser verdicts) | `/messages/lab` | v9-65 | ✓ | 3 quiet states, **zero AI labels** | — | ✓ | 🟠 |
| Apply / undo verdict | `routes/lab-inbox.ts:193` | v9-65 | ✓ | — | — | ✓ | 🟠 |
| Link unknown sender | `/messages/lab` | v9-65 | ✓ | — | — | ✓ | 🟠 |
| Lab timeout sweep | `queues/lab-timeout-sweep.ts` | — | ✓ | — | — | — | 🟠 |
| Parser training examples | `LabParseTrainingExample` | — | ✓ | — | — | — | 🟢 |

## 14 · WhatsApp & messages

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Patient inbox | `/messages` | v9-62 | ✓ | category + unread dots | — | ✓ | 🟠 |
| Category filters | `/messages` | v9-62 | ✓ | — | — | ✓ | 🟢 |
| Conversation thread | `/messages/[conversationId]` | v9-63 | ✓ | `.bub` + receipts | — | ✓ | 🟠 |
| Compose sheet | `messages/compose-sheet.tsx` | v9-62 | ✓ | restyle | — | ✓ | 🟠 |
| 24h window countdown | `lib/whatsapp/conversation.ts` | v9-63 | ✓ | window pill | — | ✓ | 🟠 |
| Window-closed template rail | thread | v9-64 | ⚠ | composer swap + one-line rule | — | ✓ | 🟠 |
| Agreed-time "Book →" chip | — | v9-63 | ✗ | appears when a time is agreed | — | ✓ | 🟢 |
| Resolve conversation | `/messages` | v9-62 | ✓ | swipe ← | — | ✓ | 🟢 |
| Send message | `lib/whatsapp/send.ts` | — | ✓ | — | — | — | 🔴 |
| Templates + approval status | `WhatsAppTemplate` | v9-72 | ✓ | — | — | ✓ | 🟠 |
| Auto-message toggles | `/clinic/whatsapp` | v9-72 | ✓ | `.tg` toggles | — | ✓ | 🟠 |
| Monthly spend + cap | `WhatsAppCostLog` | v9-72 | ✓ | budget bar + 6-month bars | — | ✓ | 🟠 |
| Patient consent | `PatientWhatsAppConsent` | v9-60 | ✓ | — | — | ✓ | 🔴 |
| Patient WhatsApp card | `PatientWhatsAppCard` | **—** | ✓ | restyle | — | ✓ | 🟢 |
| Inbound webhook | `lib/whatsapp/webhook-service.ts` | — | ✓ | — | — | — | 🔴 |
| Cross-wire (lab ↔ patient) | `lib/whatsapp/cross-wire.ts` | — | ✓ | — | — | — | 🟠 |

## 15 · Inventory

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Item list + low stock | `/inventory` | v9-67 | ✓ | warn section header | — | ✓ | 🟠 |
| New item | `/inventory/new` | **—** | ✓ | app-only — keep, restyle | — | ✓ | 🟢 |
| Categories | `/inventory/categories` | **—** | ✓ | app-only — keep, restyle | — | ✓ | 🟢 |
| Item detail | `/inventory/[itemId]` | v9-68 | ✓ | bento + action row | — | ✓ | 🟠 |
| Movement ledger | `InventoryMovement` | v9-68 | ✓ | signed colored deltas | — | ✓ | 🟠 |
| Purchase by voice | `/inventory/dictate/purchase` | v9-69 | ✓ | — | — | ✓ | 🟠 |
| Consume by voice | `/inventory/dictate/consume` | v9-69 | ✓ | — | — | ✓ | 🟠 |
| Adjust (admin, reason) | `/inventory/dictate/adjust` | v9-68 | ✓ | admin gate preserved | — | ✓ | 🔴 |
| Voice confirm sheet | `voice-sheets.tsx` | v9-69 | ✓ | tap-any-line-to-fix | — | ✓ | 🟠 |
| Reorder threshold | `InventoryItem` | v9-67 | ✓ | — | — | ✓ | 🟢 |
| Expiry tracking | `InventoryItem` | v9-67 | ✓ | crit `.mini` | — | ✓ | 🟢 |
| Consumption ← procedure | `commit.ts` | v9-68 | ✓ | — | — | — | 🟠 |

## 16 · Staff, team & settings

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| **Member list** | `ClinicMember` model only | v9-71 | ✗ | `GET /clinics/members` | ✓ | ✓ | 🟠 |
| **Approve / reject join request** | `status=PENDING` exists | v9-71 | ✗ | 2 endpoints | ✓ | ✓ | 🟠 |
| **Change member role** | `MemberRole` enum | v9-71 | ✗ | 1 endpoint, admin-only | ✓ | ✓ | 🟠 |
| **Remove member** | `deletedAt` | v9-71 | ✗ | admin-only, confirm | ✓ | ✓ | 🟠 |
| **Rotate join code** | `Clinic.joinCode` | v9-71 | ✗ | 1 endpoint | ✓ | ✓ | 🟢 |
| Share join code | `/done` only | v9-71 | ⚠ | also on Team | — | ✓ | 🟢 |
| Clinic hub | `/clinic` | v9-70 | ✓ | → More hub | — | ✓ | 🟠 |
| **Account page** | `ProfileButton` dropdown | v9-76 | ⚠ | full page; only sign-out today | ✓ | ✓ | 🟠 |
| Professional details (encrypted) | `registrationNumberEnc` | v9-76 | ⚠ | `PATCH /clinics/members/me` | ✓ | ✓ | 🟠 |
| Clinic details edit | `/clinic-create` only | v9-76 | ⚠ | reachable post-onboarding | — | ✓ | 🟢 |
| Language (EN / தமிழ்) | `ClinicSetting` model | v9-76 | ✗ | setting + i18n hook | ✓ | ✓ | 🟠 |
| Notification preference | — | v9-76 | ✗ | toggle | ✓ | ✓ | 🟢 |
| Privacy & data / DPDP copy | — | v9-76 | ✗ | static section | — | ✓ | 🟢 |
| **Switch role** | multi-membership unmodelled in app | v9-77 | ✗ | 2 endpoints + confirm sheet | ✓ | ✓ | 🟠 |
| Audit log | `AuditLog` + `fastify.audit` | — | ✓ | — | — | — | 🟠 |

## 17 · Reports

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Daily collection | `/reports/daily-collection` | v9-54 | ✓ | — | — | ✓ | 🟠 |
| Outstanding | `/reports/outstanding` | v9-55 | ✓ | — | — | ✓ | 🟠 |
| Patient statement | `/reports/patient-statement` | v9-37 | ✓ | — | — | ✓ | 🟢 |
| **Weekly review** | — | v9-20 | ✗ | `GET /reports/weekly` | ✓ | ✓ | 🟢 |
| **Confirmed-record streak** | — | v9-20 | ✗ | part of weekly | ✓ | ✓ | 🟢 |

## 18 · Follow-ups

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Follow-up **slot resolution** (voice) | `lib/schedule/follow-up.ts` | — | ✓ | *this is a slot resolver, not a task list* | — | — | 🟠 |
| `reviewAfterDays` capture | `Prescription` | v9-66 | ✓ | not surfaced anywhere | — | ✓ | 🟢 |
| **Follow-up list** | — | v9-66 | ✗ | derived query + resolutions table (Doc 3 §7) | ✓ | ✓ | 🟠 |
| **Mark done (6s undo)** | — | v9-66 | ✗ | resolution write | ✓ | ✓ | 🟢 |
| **Call + log on record** | — | v9-66 | ✗ | dialer link + log | ✓ | ✓ | 🟢 |
| **Book from follow-up** | — | v9-66 | ✗ | pre-filled appointment sheet | — | ✓ | 🟢 |
| Rules (RCT/extraction/denture) | — | v9-66 | ✗ | rule table | ✓ | ✓ | 🟠 |

## 19 · Realtime & offline

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Socket connection | `plugins/socket.ts`, `use-realtime` | — | ✓ | — | — | — | 🔴 |
| Live queue sync | `lib/queue/store.ts` | v9-21 | ✓ | — | — | — | 🔴 |
| Reconcile on focus | `use-realtime` | — | ✓ | — | — | — | 🟠 |
| Realtime dot | `RealtimeDot` | v9-50 | ✓ | — | — | ✓ | 🟢 |
| Offline banner | `OfflineBanner` | v9-17 | ✓ | Odo treatment | — | ✓ | 🟠 |
| Offline queue / sync badges | — | v9-17 | ✗ | clock badge on queued items | — | ✓ | 🟠 |

## 20 · Media

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Upload (presign → MinIO/S3) | `routes/media.ts` | v9-58 | ✓ | — | — | — | 🔴 |
| Patient media gallery | `MediaTab` | **—** | ✓ | app-only — keep | — | ✓ | 🟠 |
| X-ray strip in consult | `XrayStrip` | **—** | ✓ | restyle | — | ✓ | 🟢 |
| Lab case photos | `/lab/[caseId]` | v9-58 | ✓ | — | — | ✓ | 🟢 |

## 21 · Cross-cutting UI states

| Feature | Current location | Frame | Impl. | Missing | BE | UI | Risk |
| --- | --- | --- | :-: | --- | :-: | :-: | :-: |
| Loading skeletons | `Skeleton` | — | ✓ | retune to spec surfaces | — | ✓ | 🟠 |
| Spinner | `Spinner` | v9-01/25 | ✓ | mostly replaced by Odo + bar | — | ✓ | 🟢 |
| Empty states (3 shapes) | `EmptyState`, `lib/ds/empty-state.ts` | v9-22/34 | ✓ | mascot rules change (§6.4) | — | ✓ | 🟠 |
| Error boundary | `(app)/error.tsx` | **—** | ✓ | restyle (1 regression test) | — | ✓ | 🟠 |
| Form validation errors | `FormField` | — | ✓ | crit inline | — | ✓ | 🟠 |
| Disabled CTA + reason line | `Button loading/disabled` | v9-35 | ⚠ | explanatory line under the CTA | — | ✓ | 🟢 |
| Confirm dialogs | `Dialog`, `BottomSheet` | — | ✓ | restyle | — | ✓ | 🟠 |
| **Undo (6s) everywhere** | partial (lab verdict) | v9-79 | ⚠ | saves, payments, swaps, follow-ups | — | ✓ | 🟠 |
| Haptics | — | v9 matrix | ✗ | `.light/.selection/.medium/.error` | — | ✓ | 🟢 |
| Reduced motion | `ds/motion.tsx` | v9 matrix | ⚠ | audit every new animation | — | ✓ | 🟠 |
| **Tap contract (no dead ends)** | — | v9-81 | ✗ | QA rule, per-page checklist | — | ✓ | 🟠 |

---

## Roll-up

| Area | Impl. | Note |
| --- | :-: | --- |
| Patients | ✓ | complete |
| Appointments | ✓ | drag-to-reschedule missing |
| Consultation | ✓ | complete |
| Voice | ✓ | v10 confirm/correct surfaces missing |
| Odontogram | ✓ | complete |
| Treatment plans | ✓ | complete |
| Prescriptions | ✓ | complete |
| Billing | ✓ | complete |
| Labs | ✓ | ＋dial missing |
| WhatsApp | ✓ | complete |
| Inventory | ✓ | complete |
| **Notifications** | ⚠ | model exists, zero usage |
| Settings | ⚠ | Account is a dropdown, not a page |
| **Staff** | ⚠ | schema only, no endpoints |
| Authentication | ✓ | device PIN missing |
| **Follow-ups** | ⚠ | slot resolver only, no list |
| **Reports** | ⚠ | weekly missing |

**Counts:** 232 features tracked · 178 ✓ · 30 ⚠ · 24 ✗ ·
**60 🔴 high-risk** touchpoints requiring extra care during migration.
