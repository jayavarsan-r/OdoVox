# Document 2 — Component Mapping

> Every component in `apps/web`, with an explicit verdict. **No component gets
> rewritten on a whim** — `REPLACE` appears 3 times in 76 components, and each one
> cites the design frame that mandates it.

## Verdict definitions

| Verdict | Meaning | Public API |
| --- | --- | --- |
| **REUSE** | Untouched by the migration | unchanged |
| **MODIFY** | Same file, internals restyled to the spec | unchanged (or additive props only) |
| **REPLACE** | Implementation replaced because the design frame mandates a different component | may change — each is justified below |
| **NEW** | Does not exist | — |

**Bias: MODIFY.** Where a spec surface could be read as "a new component", the default
is an additive variant on the existing one rather than a new file. Additive props never
break existing call sites.

**Totals: 76 existing components → 21 REUSE · 52 MODIFY · 3 REPLACE · 24 NEW.**

---

## 1 · Design-system primitives (`components/ds/`)

| Component | Design counterpart | Verdict | What changes | API change |
| --- | --- | --- | --- | --- |
| `hero-card.tsx` | `.hero-c` (v9-13/15), `.rolec` (v9-07) | **MODIFY** | Retune 4 variants to spec elevation + highlight; **add** `variant="flow"` for the lime-gradient `.hero-c` | additive variant |
| `glass-card.tsx` | `.lgnav`, `.vmenu` glass | **MODIFY** | Retune to `--glass` + `--glass-line` (brighter edge, `saturate(1.9)`). **Usage audit:** spec puts glass only on the nav and the voice menu — remove from `queue-cards` | none |
| `stat-tile.tsx` | `.stat` pill (v9-56) + `.bt` tile | **MODIFY** | Spec law: "a lone number never gets a tile — it gets a 46px stat pill". **Add** `shape="pill" \| "tile"`, default `pill` | additive prop |
| `empty-state.tsx` | v9-22, v9-34 | **MODIFY** | Restyle 3 shapes; mascot policy changes per §6.4 (sleeping Odo now allowed on empty working screens) | none |
| `fab.tsx` (`FAB`, `FabMenu`) | `.dial` / `.dpill` (v9-18, v9-57) | **MODIFY** | Re-anchor above the orb; `.dpill` pill styling; 30ms stagger. **`lib/ds/fab.ts` (`fabReducer`, `dispatchFabItem`) is reused untouched — it's tested** | none |
| `editorial-heading.tsx` | `.eyebrow` + `.h-display` | **MODIFY** | Spec type ladder + tracking | none |
| `stepper-header.tsx` | `.ob-dots` (v9-08) | **MODIFY** | Dots treatment; `lib/ds/stepper.ts` untouched (tested) | none |
| `motion.tsx` | v9 active-state matrix | **MODIFY** | Retime to spec: 80–120ms press, 180–220ms state, 30/45/50ms staggers | none |
| `decorative-footer.tsx` | — | **REUSE** | Used on `/phone` + `/otp`; inherits token retune | none |
| `annotation-callout.tsx` | — | **REUSE** | **Zero call sites** — dead-code candidate (§6) | none |
| `index.ts` | — | **MODIFY** | Barrel: add new exports | additive |

## 2 · UI primitives (`components/ui/`)

| Component | Design counterpart | Verdict | What changes | API change |
| --- | --- | --- | --- | --- |
| `button.tsx` | `.cta` / `.btn2` (v9 matrix) | **MODIFY** | 52px `.cta` w/ lime glow + inner highlight; press → `--lime-press` + scale .98; `.dis` = `#E7EAE0`; `.btn2` = the `outline` variant at 44px | none |
| `card.tsx` | `.card` | **MODIFY** | 26px radius, `0 10px 28px rgba(31,42,35,.06)` + inner top highlight. **Add** `wash` prop (the lime radial corner glow) | additive prop |
| `badge.tsx` | `.gchip` (28px pill) + `.mini` (22px, r7) | **MODIFY** | **Add** `size="chip" \| "mini"` and the six spec tones (lime/sky/crit/warn/live/lav/pine). One component, two sizes — no new file | additive props |
| `avatar.tsx` | `.av` + 4 status rings | **MODIFY** | **Add** `ring="lime" \| "live" \| "sky" \| "none"` (the spec's double box-shadow ring) | additive prop |
| `input.tsx` | `.frm` (48) / `.field` (56) | **MODIFY** | **Add** `size` and `voiced` (the 3px lime inset spine that fades on first touch) | additive props |
| `tabs.tsx` | `.ptabs` | **MODIFY** | Inset pill group on a 5% pine wash; white active pill with shadow. Radix internals untouched | none |
| `bottom-sheet.tsx` | `.sheet` + `.grab` | **MODIFY** | 26px top radius, grab handle, `0 -10px 36px` shadow, spec scrim | none |
| `sheet.tsx` | `.sheet` | **MODIFY** | Same treatment (Radix variant) | none |
| `dialog.tsx` | `.sheet` / modal | **MODIFY** | Spec surface + scrim | none |
| `skeleton.tsx` | — | **MODIFY** | Retune to spec surfaces | none |
| `spinner.tsx` | — | **REUSE** | Spec replaces most spinners with Odo + a bar; the component stays for edge cases | none |
| `waveform.tsx` | `.wave` (v10-01) | **MODIFY** | 3.5px bars, pine fill, amplitude-driven; reduced-motion → static level bar | none |
| `voice-button.tsx` | `.mic-a` / orb | **MODIFY** | `.mic-a` 38px lime-soft rounded square for in-field use | none |
| `logo.tsx` | v9-01 wordmark | **MODIFY** | `.18em` tracking, spec weight | none |
| `scroll-area.tsx` | — | **REUSE** | **Zero call sites** — dead-code candidate | none |
| `separator.tsx` | — | **REUSE** | **Zero call sites** — dead-code candidate | none |

## 3 · App shell (`components/app-shell/`)

| Component | Design counterpart | Verdict | What changes | API change |
| --- | --- | --- | --- | --- |
| `bottom-tabs.tsx` | `.lgnav` (v9, all frames) | **MODIFY** | 5 → 4 tabs, glass pill at 72px, 36px radius, 52px active capsule. `layoutId="tab-pill"` animation and the sr-only inactive labels are **kept** (regression test) | none (`{role}`) |
| `profile-button.tsx` | v9-76 Account | **MODIFY** | Avatar restyle; the dropdown gains an "Account" entry linking to the new `/account` page. **The existing logout stays in the dropdown** — nothing moves out from under the user | none |
| `placeholder-page.tsx` | — | **REUSE** | **Zero call sites** — dead-code candidate | none |

## 4 · Root components (`components/`)

| Component | Design counterpart | Verdict | What changes | API change |
| --- | --- | --- | --- | --- |
| `mobile-shell.tsx` | `.screen` | **MODIFY** | Canvas token + safe areas | none |
| `animated-page.tsx` | page transitions | **MODIFY** | Spec durations/easings | none |
| `gradient-mesh.tsx` | `.amb` ambient wash | **MODIFY** | Becomes the spec's two-radial ambient wash (lime 20% top-left, sky 10% top-right) with an `opacity` prop. §6.4 now allows it on `(app)/*` | additive prop |
| `dev-banner.tsx` | — | **MODIFY** | Restyle | none |
| `voice-search-input.tsx` | `.frm` + `.mic-a` (v9-33) | **MODIFY** | Search field with the mic inside | none |
| `empty-state.tsx` | superseded by `ds/empty-state` | **REUSE** | **Zero call sites** — dead-code candidate (duplicate) | none |

## 5 · Forms (`components/forms/`)

| Component | Design counterpart | Verdict | What changes | API change |
| --- | --- | --- | --- | --- |
| `FormField.tsx` | `.frm-lb` + error | **MODIFY** | 11px/800 `+.06em` label; crit inline error | none |
| `PhoneInput.tsx` | `.field` (v9-03) | **MODIFY** | 56px, `🇮🇳 +91` divider, mic affordance, 5-5 grouping | none |
| `OtpInput.tsx` | `.otp` (v9-04/05) | **MODIFY** | 6 × 56px boxes, sky focus outline, crit error + shake + auto-clear | none |
| `Select.tsx` | `.frm` | **MODIFY** | Field chrome | none |
| `TimeInput.tsx` | `.frm` (v9-73) | **MODIFY** | Field chrome | none |
| `ChipMultiSelect.tsx` | `.gchip` toggles (v9-35/36) | **MODIFY** | Chip toggle styling | none |
| `Stepper.tsx` | `.seg` | **MODIFY** | Segmented-control styling | none |

## 6 · Onboarding (`components/onboarding/`)

| Component | Design counterpart | Verdict | What changes | API change |
| --- | --- | --- | --- | --- |
| `choice-card.tsx` | `.rolec` (v9-07) | **MODIFY** | 24px radius, 48px tinted icon square, 2.5px pine selected outline | none |
| `back-header.tsx` | `.icirc` chevron | **MODIFY** | 40px icon circle | none |
| `wizard-shell.tsx` | `.ob` layout (v9-08) | **MODIFY** | 22px gutters, dots, sticky CTA | none |

## 7 · Voice (`components/voice/`)

| Component | Design counterpart | Verdict | What changes | API change |
| --- | --- | --- | --- | --- |
| `verification-card.tsx` | v9-27…30 | **MODIFY** | **Prerequisite: split into sub-components as a pure refactor with all 5 regression tests green *before* any restyle.** Then: bento header, medicine list, `.paper` block, crit rail. Safety logic in `lib/consult/*` is untouched | none |
| `recorder.tsx` | v9-23/24 | **MODIFY** | Concentric breathing rings, 56px tabular timer, 92px lime mic, Pause 62 / Finish 76-pine. `useConsultStore` untouched | none |
| `progress-strip.tsx` | v9-25 | **REPLACE** | **Justification: frame 25 explicitly deletes this component** — *"Stage chips deleted — three visible steps made 15 seconds feel like three waits."* Replaced by Odo + one looping bar + "Usually under 20 seconds". Same prop `{state}`; `progress-strip-copy` regression test is rewritten to assert the new copy | prop kept |
| `voice-input.tsx` | v10-01/04 | **MODIFY** | Live transcript, entity lift, `.wave`, low-confidence dotted underline | additive props |
| `voice-command-hero.tsx` | v10-01 | **MODIFY** | Home's voice entry folds into the orb hold; **the hero card stays as a second, discoverable entry point** (nothing disappears) | none |

## 8 · Consult (`components/consult/`)

| Component | Design counterpart | Verdict | What changes | API change |
| --- | --- | --- | --- | --- |
| `patient-context-card.tsx` | v9-23 header | **MODIFY** | Avatar + name + `.mini` glyph strip + REC chip. `consult-context-card-layout` test updated | none |
| `complaint-strip.tsx` | v9-23 chip | **MODIFY** | `.gchip` | none |
| `xray-strip.tsx` | v9-58 photo strip | **MODIFY** | 72px tiles + camera tile | none |

## 9 · Queue (`components/queue/`)

| Component | Design counterpart | Verdict | What changes | API change |
| --- | --- | --- | --- | --- |
| `queue-cards.tsx` | `.vrow` + `.av` (v9-21/50) | **MODIFY** | Rows to `.vrow`, avatars to `.av` + status rings. **Remove `GlassCard` from repeating rows** (spec + perf budget) | none |
| `walk-in-sheet.tsx` | v9-51 | **MODIFY** | Sheet body | none |
| `checkout-sheet.tsx` | v9-52 | **MODIFY** | `.kv` items, hairline rule, 30px payable, `.seg` methods. `take-payment-sheet-shows-items-and-total` test kept | none |
| `add-to-queue-sheet.tsx` | — | **MODIFY** | Restyle (no frame — same language) | none |
| `queue-action-sheet.tsx` | — | **MODIFY** | Restyle (no frame) | none |
| `activity-feed.tsx` | — | **MODIFY** | Restyle (no frame) | none |
| `realtime-dot.tsx` | `● LIVE` + offline banner | **MODIFY** | Live dot; `OfflineBanner` gets the concerned-Odo treatment (v9-17) | none |
| `next-up-hint.tsx` | v9-14/23 footer | **MODIFY** | "Next · Lakshmi N. · 11:00" | none |

## 10 · Schedule (`components/schedule/`)

| Component | Design counterpart | Verdict | What changes | API change |
| --- | --- | --- | --- | --- |
| `day-view.tsx` | v9-46 | **MODIFY** | Hairline hour rules, `.appt` 3.5px state bars, `.lunch` hatch, `.nowline` | none |
| `multi-doctor-day.tsx` | v9-47 | **MODIFY** | Columns, shared now-line, per-doctor off-shading | none |
| `week-strip.tsx` | `.week` / `.wd` | **MODIFY** | Lime capsule + glow on the focused day. `lib/schedule/week-strip.ts` untouched (tested) | none |
| `new-appointment-sheet.tsx` | v9-48 | **MODIFY** | Sheet body, free-slot chips | none |
| `appointment-detail-sheet.tsx` | — | **MODIFY** | Restyle (no frame) | none |
| `slot-picker.tsx` | `.slot-hint` | **MODIFY** | Dashed free-slot hints | none |

## 11 · Domain (billing / inventory / lab / whatsapp / odontogram)

| Component | Design counterpart | Verdict | What changes | API change |
| --- | --- | --- | --- | --- |
| `billing/bill-sheet.tsx` | v9-41 | **MODIFY** | `.kv` items + payments | none |
| `inventory/voice-sheets.tsx` | v9-69 | **MODIFY** | The parse→confirm template. `lib/inventory-voice.ts` untouched (tested) | none |
| `whatsapp/patient-whatsapp-card.tsx` | — | **MODIFY** | Restyle (no frame) | none |
| `odontogram/odontogram.tsx` | `.odn` (v9-40) | **MODIFY** | 19×24px cells, `6px 6px 8px 8px` radius, 8px midline gap. **`TOOTH_TONE` must be re-mapped** — the current map is inverted vs the spec legend (see below) | none |

**Odontogram tone correction** (spec legend, v9-40):

| Status | Current | Spec |
| --- | --- | --- |
| RCT | `bg-lavender` | **lime + 2.5px glow ring** |
| CROWN | `bg-lime` | **sky-soft + sky border/text** |
| CARIES | `bg-peach` | **warn-soft + warn border/text** |
| MISSING | 40% opacity | **transparent + dashed border**, still tappable |

## 12 · Illustrations (`components/illustrations/`)

| Component | Design counterpart | Verdict | What changes | API change |
| --- | --- | --- | --- | --- |
| `mascot-moment.tsx` | Odo, all poses | **MODIFY** | Spec sizes; **new poses required**: `listening` (v10-01, mouth open + sound arcs), `concerned` (v9-17 offline). `lib/ds/mascot.ts` gains the mappings (tested) | additive poses |
| `line-illustrations.tsx` | — | **REUSE** | Inherits the token retune | none |
| `decorative-art.tsx` | — | **REUSE** | Only referenced by its barrel — dead-code candidate | none |
| `index.tsx` | — | **MODIFY** | Barrel | additive |

---

## 13 · NEW components (24)

Each is a spec surface with no existing equivalent. Grouped by the wave that builds it.

### Wave 1 — atoms (7)

| Component | Spec | Purpose |
| --- | --- | --- |
| `IconCircle` | `.icirc` | 44px white circle w/ shadow + inner highlight — used ~40× across the spec |
| `Toggle` | `.tg` | 46×28 track, lime when on |
| `StatDot` | `.statdot` | 10px status dot |
| `DoseDots` | `.dd` | ●○● morning–afternoon–night, readable across a room |
| `ProgressRing` | `.ringwrap` | SVG ring + centred label (Home hero, patient overview) |
| `Segmented` | `.seg` | Segmented control (Day/Week/Mo, payment method, doctor picker) |
| `Hairline` | `.hair` rules | Shared 1px alpha-over-pine divider |

### Wave 2 — surfaces (6)

| Component | Spec | Purpose |
| --- | --- | --- |
| `BentoTile` | `.bt` + 4 tints | Structured tile (money + breakdown, dates, warnings) |
| `QuickTile` | `.qt` / `.qt.wide` | Home quick tools — currently a local function inside `/home` |
| `PaperBlock` | `.paper` | Clinical record prose: 16.5px/1.7, hairline left rule |
| `ListRow` | `.vrow` | The single most-repeated surface in the spec |
| `SettingRow` | `.set-row` | Settings list row w/ 32px tinted icon |
| `SectionHeader` | `.sec` | Title + trailing action, used on every list screen |

### Wave 3 — navigation & domain (11)

| Component | Spec | Purpose |
| --- | --- | --- |
| `Orb` | `.actbtn` | 66px lime orb: tap = context action, hold 350ms = voice menu, per-tab ring |
| `NavDock` | `.navwrap` | Composes `BottomTabs` + `Orb` at 11px apart |
| `VoiceMenu` | `.vmenu` | Orb-hold menu, first row names who gets recorded |
| `DayRiver` | `.dayriver` | Home habit loop — 8 segments, tap → schedule |
| `JourneyRail` | `.jy` | Horizontal 6-step rail (lab case stages) |
| `VerticalJourney` | `.vj` | Vertical sitting journey (patient Cases tab) |
| `Timeline` | `.tl` | Odo-mood history spine |
| `MedicineRow` | `.medrow` | n-scalable medicine list row + crit conflict rail |
| `AppointmentBlock` | `.appt` | Timeline block w/ 3.5px state bar |
| `Checklist` | `.chk` | First-day setup checklist rows |
| `Bars` | `.bars` | Hourly / monthly bar strips (billing, WhatsApp spend) |

---

## 14 · Components with no design frame

These have **no frame in either spec**. Per the zero-regression rule they are all
**kept and redesigned in the same visual language** — never removed, never hidden.

`add-to-queue-sheet` · `queue-action-sheet` · `activity-feed` ·
`appointment-detail-sheet` · `patient-whatsapp-card` · `xray-strip` ·
`dev-banner` · `(app)/error.tsx` · `Select` · `TimeInput` ·
patient **Media** tab · `/inventory/new` · `/inventory/categories` ·
`/lab/[caseId]/edit` · `/clinic-choice` · `messages/compose-sheet`

## 15 · Dead-code candidates (no call sites)

Found during the audit. **Not part of this migration and not deleted without your
sign-off** — listed so they don't get restyled for nothing:

`components/empty-state.tsx` (duplicate of `ds/empty-state.tsx`) ·
`components/ds/annotation-callout.tsx` · `components/app-shell/placeholder-page.tsx` ·
`components/ui/scroll-area.tsx` · `components/ui/separator.tsx` ·
`components/illustrations/decorative-art.tsx` (barrel-only)

Default action: **leave in place, skip during migration.** Say the word and I'll
remove them as a separate, isolated commit.

---

## 16 · Summary

| Verdict | Count |
| --- | --- |
| REUSE | 21 |
| MODIFY | 52 |
| **REPLACE** | **3** |
| NEW | 24 |

### The three REPLACEs, justified

1. **`voice/progress-strip.tsx`** — frame 25's own note deletes it: *"Stage chips
   deleted — three visible steps made 15 seconds feel like three waits."* Prop
   signature preserved.
2. **`QuickTile`** (currently a private function inside `app/(app)/home/page.tsx`) —
   promoted to a real component so `/home` and `/more` share it. Not a rewrite; a
   relocation.
3. **`OfflineBanner`** (inside `queue/realtime-dot.tsx`) — frame 17 makes it a
   distinct full-state surface with the concerned-Odo treatment rather than a strip.
   Extracted to its own component; `RealtimeDot` itself is MODIFY.

Everything else is either untouched or restyled in place with an unchanged public API.
