# Odovox UI migration report

> **Status: awaiting approval. No code has been written.**
>
> Source specifications: `odovox-v9-master.html` (81 frames) and `odovox-v10-talk.html`
> (5 frames). Treated as a Figma file — nothing from them will be copied, pasted, or
> stitched into the app. Target: `apps/web` (Next.js App Router, 44 routes).

---

## 1. What this migration actually is

The v9/v10 specs are **not a reskin of the current design system** — they are a
different design system that happens to share a lime accent. The current system
(`packages/ui/src/tokens.css`, locked at Phase 2.5) is built on:

- near-black ink `#0a0a0a` on warm white `#fafaf7`
- neutral grey text (`#6b7280`) and neutral grey borders (`#e5e7eb`)
- pastel *backgrounds* as category colors (peach / sky / lavender / sage)
- neutral-black shadows, Geist Sans, 5-tab navigation

The spec is built on:

- **pine** `#1F2A23` (a dark green-black) on canvas `#F6F7F2`, with every muted text
  and every hairline expressed as **alpha over pine**, never as a grey
- saturated *foreground* colors (`--sky #5B8DEF`, `--live #2E8B62`, `--warn #B96A25`,
  `--lav #8B7CF6`, `--crit #CB3534`) each paired with a soft background
- **pine-tinted shadows plus a white inner top-highlight on every raised surface**
- **4 tabs in a glass pill + a 66px lime orb**

So this is a token-layer replacement propagating through every primitive, not a
per-page restyle. Migrating pages before the tokens and primitives are right would
mean doing the work twice.

### The three details that make it read as "handcrafted" rather than "recolored"

1. **`inset 0 1px 0 rgba(255,255,255,.9)`** — a 1px white highlight on the top edge of
   every card, stat pill, tile, and CTA. The current system has no equivalent. This
   single token is most of the perceived quality difference.
2. **Alpha-over-pine hairlines** (`rgba(31,42,35,.07)`) instead of a grey border. Rules
   sit *in* the surface rather than on top of it.
3. **The ambient wash** (`.amb`) — two fixed radial gradients (lime top-left at 20%,
   sky top-right at 10%) behind every screen at varying opacity. Note this directly
   contradicts the current `no-wash-on-app-routes` regression test (see §6.4).

---

## 2. Token delta

### 2.1 Color

| Concept | Current token | Spec value | Verdict |
| --- | --- | --- | --- |
| Canvas | `--color-paper #fafaf7` | `--canvas #F6F7F2` | Retune |
| Card | `--color-surface #ffffff` | `--card #FFFFFF` | Same |
| Primary text | `--color-ink #0a0a0a` | `--pine #1F2A23` | **Retune — app-wide hue shift** |
| Secondary text | `--color-text-muted #6b7280` | `--pine-2 rgba(31,42,35,.55)` | **Replace (grey → alpha)** |
| Tertiary text | `--color-text-subtle #9ca3af` | `--pine-3 rgba(31,42,35,.36)` | **Replace (grey → alpha)** |
| Hairline | `--color-border #e5e7eb` | `--hair rgba(31,42,35,.07)` | **Replace** |
| Hairline strong | `--color-border-strong #d1d5db` | `--hair-2 rgba(31,42,35,.13)` | **Replace** |
| Primary accent | `--color-lime #d4f564` | `--lime #CDE763` | Retune |
| Accent soft | `--color-lime-soft #e8f8b5` | `--lime-soft #EEF5D2` | Retune |
| Accent pressed | — | `--lime-press #BCD850` | **New** |
| Accent glow | (inside `--elev-lime-glow`) | `--lime-glow rgba(205,231,99,.5)` | **New (standalone)** |
| Schedule / time | `--color-sky #bfe3ff` (bg) | `--sky #5B8DEF` (fg) + `--sky-soft #E8EFFC` | **Semantic inversion** |
| Clinical / success | `--color-sage #7ba098` | `--live #2E8B62` + `--live-soft #E2F1E9` | **Rename + resaturate** |
| Attention / warmth | `--color-peach #ffd4a3` | `--warn #B96A25` + `--warn-soft #F9EEDC` | **Semantic inversion** |
| Lab / special | `--color-lavender #e0d4ff` | `--lav #8B7CF6` + `--lav-soft #EFECFD` | **Semantic inversion** |
| Danger | `--color-danger #dc2626` | `--crit #CB3534` (Persian red) | Retune + **new law** (§2.5) |
| Glass fill | `rgba(255,255,255,.65)` | `--glass rgba(252,253,249,.55)` | Retune |
| Glass edge | `--glass-border-light rgba(255,255,255,.4)` | `--glass-line rgba(255,255,255,.95)` | **Retune — much brighter** |

The four "semantic inversions" are the trickiest mechanical change: in the current
system `bg-sky-soft` + `text-info` is a tile; in the spec `--sky` *is* the ink and
`--sky-soft` *is* the tile. Every `.mini`/`.gchip`/`.stat`/`.bt` variant follows the
same `{soft background, saturated same-hue text}` pairing. That regularity is what
makes the chip language coherent, and it needs a shared variant helper rather than
per-site Tailwind classes.

### 2.2 Elevation, and the missing highlight

Every raised surface in the spec is `pine-tinted drop shadow + white inner top edge`:

| Surface | Spec shadow |
| --- | --- |
| `.card` | `0 10px 28px rgba(31,42,35,.06), 0 1px 0 rgba(255,255,255,.9) inset` |
| `.bt` (bento tile) | `0 8px 20px rgba(31,42,35,.06)` |
| `.qt` (quick tile) | `0 6px 16px rgba(31,42,35,.06), inset 0 1px 0 rgba(255,255,255,.8)` |
| `.stat` (stat pill) | `0 6px 16px rgba(31,42,35,.06), inset 0 1px 0 rgba(255,255,255,.9)` |
| `.icirc` | `0 6px 16px rgba(31,42,35,.08), inset 0 1px 0 rgba(255,255,255,.9)` |
| `.cta` | `0 8px 22px var(--lime-glow), inset 0 1.5px 0 rgba(255,255,255,.7)` |
| `.actbtn` (orb) | `0 16px 36px var(--lime-glow), 0 6px 14px rgba(31,42,35,.18), inset 0 2px 1px rgba(255,255,255,.85)` |
| `.lgnav` (glass nav) | `0 18px 44px rgba(31,42,35,.22), inset 0 2px 1px rgba(255,255,255,.95)` |
| `.sheet` | `0 -10px 36px rgba(31,42,35,.22)` |

The current `--elev-0…4` ladder is neutral-black and highlight-less. It is retuned
in place (same names) so every existing `shadow-elev-*` consumer inherits the change.

### 2.3 Radius

The spec has a far richer ladder than the current 8/12/20/28/pill:

`mini 7` · `set-ic 11` · `key 12` · `mic-a 13` · `appt/qi 14` · `frm/otp 16` ·
`stat 17` · `field 18` · `bub/tlcard/vrow-card 18–19` · `bt 20→24` ·
`qcard/medcard/qt 22` · `rolec/vmenu 24` · `hero-c 24` · `card 26` · `sheet 26 26 0 0` ·
`lgnav 36` · `phone 46` · pill `999`

Proposal: extend to `--radius-2xs 7 · xs 11 · sm 14 · md 16 · lg 18 · xl 22 · 2xl 24 ·
3xl 26 · pill`, keeping the existing names' *positions* where possible so current
consumers shift coherently rather than arbitrarily.

### 2.4 Type

| | Current | Spec |
| --- | --- | --- |
| Family | Geist Sans / Geist Mono | Apple/Android system stack |
| Display | 48 / 32 / 28 / 24 / 20 | `h-display` 30 (24–28 in situ), `ob-q` 27, `sh-title` 19–21 |
| Body | 18 / 16 / 14 / 13 / 11 | 16.5 / 15.5 / 14 / 13.5 / 12.5 / 11.5 / 11 |
| Micro | — | 10.5 / 10 / 9.5 / 9 (eyebrows, `.bl`, `.jyl`) |
| Weights | 500 / 600 | **650 / 700 / 750 / 800** |
| Tracking | default | `-.03em` display, `-.02em` headings, `+.12em` eyebrows, `+.08em` `.bl` |
| Record prose | — | **16.5px / 1.7** (`.paper`) — an explicit chair-side legibility rule |

The weight ladder is the visible difference: the spec is 800-heavy where the app is
600. Everything numeric is `tabular-nums`.

**Open question — typeface.** Matching the spec literally means dropping Geist for the
system stack, which renders as SF Pro on iOS and Roboto on Android (i.e. two different
products). Recommendation: keep Geist Sans, adopt the spec's size/weight/tracking
ladder exactly. Flagged in §6.5.

### 2.5 New semantic laws in the spec (currently unenforced)

- **Red = "act now", never decoration.** A `#CB3534` 3.5px *inset left rail* on the
  offending row + red name + one factual clinical line. No pink washes, no banners,
  no "AI" voice. Applies identically to: drug conflicts, overdue follow-ups,
  permanent medical facts in history.
- **A lone number never gets a tile** — it gets a 46px `.stat` pill. Tiles are reserved
  for content with structure (money + breakdown, warnings, dates).
- **The tap contract (frame 81).** "If it names a thing, it opens that thing. If it
  shows a number, it opens where the number comes from. If it can't be tapped, it
  doesn't get a chevron." This is a QA rule, not a screen.
- **Toasts have exactly three voices** (frame 79): success (4s, always undoable),
  problem (sticky + Retry), offline (persistent, calm). One at a time, above the nav.
- **Undo everywhere, 6s** — saves, payments, swaps, follow-up ✓. Records are
  append-only via Amend.

### 2.6 Motion

Spec values, all currently absent as tokens: pressed 80–120ms · state changes
180–220ms ease-out · dial pills stagger 30ms · timeline cards stagger 45ms · bars
stagger 50ms · orb hold threshold 350ms · timeline spine draw 350ms · number count-up
400ms · success beat 1.2s · undo window 6s · voice end-of-speech pause 1.2s.
Reduced-motion: everything appears static.

---

## 3. Navigation restructure — the one structural change

| | Current | Spec (frames 12–81, every nav instance) |
| --- | --- | --- |
| Shape | 5 tabs, paper pill, `bg-paper/95 backdrop-blur-md` | **4 tabs in a 72px glass pill + a separate 66px lime orb**, 11px apart |
| Doctor tabs | Home · Patients · Schedule · Lab · Clinic | **Flow · Patients · Schedule · More** |
| Reception tabs | Today · Patients · Schedule · Lab · Billing | **Today · Patients · Schedule · More** |
| Active state | lime pill, icon + label | Same idea, spec dimensions (52px cap, 20px icon, 13.5px/800 label) |
| Orb | none (there is a separate `FabMenu`) | Doctor = mic · Reception = ＋. Tap = context action, **hold 350ms = voice menu** |

`/lab`, `/clinic`, `/billing` lose their tab slot. Frame 70 ("More — module hub") is
their new home: a 2×2 bento of modules with live counts (Lab · Messages · Inventory ·
Billing) over a settings list (WhatsApp · Availability · Days off · Rx templates ·
Team & join code · Account).

**No route is renamed or removed.** The proposal is to add `/more` as frame 70 and
point tab 4 at it; `/lab`, `/clinic`, `/billing`, `/messages`, `/inventory` keep their
paths, keep their RBAC rules, and stay directly linkable. See §6.1 for the decision.

The existing `FabMenu` (bottom-right lime `+`) is superseded by the orb + speed dial
(frame 18): pills stack *above* the orb, stagger bottom-up 30ms, orb rotates to ✕.
Same behaviour, different anchor — `lib/ds/fab.ts` (`fabReducer`, `dispatchFabItem`,
both tested) is reused as-is; only the presentation changes.

---

## 4. Screen-by-screen migration map

Complexity: **S** ≤ ½ day · **M** ~1 day · **L** ~2 days · **XL** > 2 days.
"Reuse" = keep the component, restyle internals. "Rewrite" = presentation replaced.

### A · Entry

| Route | Frame | Visual changes | Reuse | Rewrite | Complexity | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 01 Splash | Odo + 4px lime progress hairline replaces the spinner; ambient wash | `MascotMoment`, `LogoLockup` | `Spinner` → hairline | S | Low |
| `/welcome` | 02 Welcome | Odo 140px + sparkles, 29px headline, 3 `.ob-dots`, `.cta`, "Free for your first 50 patients" | `MascotMoment` | Page body | S | Low |
| `/phone` | 03 Phone | `.field` 56px w/ `+91` divider + mic affordance, `.cta`, pre-summoned `.keypad` | `PhoneInput` logic | Field chrome, keypad is new | M | Custom keypad vs native — spec shows a rendered pad |
| `/otp` | 04, 05 | 6 × 56px `.otp` boxes, sky focus outline, "Reading SMS automatically…", resend countdown; error = crit outline + shake + clear | `OtpInput` logic | Box chrome, error state | M | Shake/haptic timing (400ms) |
| — | 06 Face ID | **Spec-only** — no biometric unlock exists | — | — | — | §6.2 |

### B · Clinic setup

| Route | Frame | Visual changes | Reuse | Rewrite | Complexity | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/role` | 07 | `.rolec` cards (48px tinted icon square, 16.5px/800 title), selected = 2.5px pine outline | `ChoiceCard` | Card chrome | S | Low |
| `/clinic-choice` | — | **App-only** (spec routes Role → Create/Join directly). Restyle in `.rolec` language, keep the screen | `ChoiceCard` | — | S | Low |
| `/clinic-create/step-{1,2,3}` | 08 | `.ob-dots` progress, verified-identity chip, `.field` + mic, defaults card. **Spec collapses 3 steps → 1**; we keep all 3 | `WizardShell`, all Zod schemas | Step chrome | M | §6.3 — do not collapse |
| `/clinic-join` | 09, 10 | `.field` with live ✓, clinic preview card w/ lime-ring avatar; pending = Odo thinking + pulse dots | `BackHeader` | Page body, pending state | M | Pending-approval state may not exist yet |
| `/done` | 11 | Odo celebrating 140px, join-code share card, `.cta` "Go to Flow" | `MascotMoment`, QR/share | Page body | S | `qrcode.react` literal colors stay documented |
| — | 12 First-day checklist | **Spec-only** | — | — | — | §6.2 |

### C · Home / Flow

| Route | Frame | Visual changes | Reuse | Rewrite | Complexity | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/home` | **13** (primary), 14, 15, 16, 17 | Complete rebuild. Eyebrow + 24px greeting + lime ＋ + avatar; **day river** (8 segments, tap → schedule); caption line replaces stat tiles; `.hero-c` gradient card with progress ring + patient + inline CTA; 2×2 `.qb` quick tiles + wide day-off bar; "Up next" `.hscroll` `.qcard`s; "Needs you" `.vrow` list | `useNeedsYou`, `useSchedule`, `useQueueSnapshot`, `useQueueStore`, `consultHeroSubtitle`, `EmptyState` | `QuickTile` → `.qt`, `HeroCard` → `.hero-c`, `VoiceCommandHero`, `VoiceSearchInput`, `FabMenu` → orb dial | **XL** | Highest-traffic screen; four additional states (14/15/16/17) must all be reachable from real data, not mocked |
| `/home` (＋) | 18 Speed dial | Pills stack above the orb, scrim, orb → ✕ | `fabReducer` (tested) | `FAB`/`FabMenu` presentation | M | Anchor moves from corner to orb |
| — | 19 Day-off quick sheet | Spec makes it a sheet from the header; app has `/clinic/day-off` as a page | — | — | — | §6.3 — keep the page, optionally add the sheet later |
| — | 20 Week in review | **Spec-only** (needs a weekly-aggregate endpoint) | — | — | — | §6.2 |

### D · Consult pipeline

| Route | Frame | Visual changes | Reuse | Rewrite | Complexity | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/consult` | 21, 22 | "Consult" 28px + live/quiet chip; "Now treating" `.card.wash` w/ live-ring avatar + `.cta` Record + undo circle; Waiting `.vrow`s with lime "Call in"; "Sent to checkout" dimmed. Empty = sleeping Odo + two exits | `useQueueStore`, selectors, `QueueCards`, `QueueActionSheet` | Row/card chrome, empty state | L | Orb gets a ring-highlight on this tab |
| `/consult/[id]` | **23** Recording | Nav hidden; 56px tabular timer; three concentric breathing lime rings + 92px lime mic; live complaint chip; Pause (62px) / Finish (76px pine) | `useConsultStore`, `Recorder` state machine, `ComplaintStrip` | `Recorder` presentation, `Waveform` | L | Recording is the core act — zero tolerance for regression |
| | 24 Paused | Rings freeze grey, warn banner, Resume becomes the big lime target | `Recorder` | Paused face | M | Auto-pause-on-call must survive |
| | 25 Processing | **Spec deletes the 3-step strip**: Odo thinking + "Processing" + one looping bar + "Usually under 20 seconds" | — | `ProgressStrip` | M | Regression test `progress-strip-copy` asserts the current 3-step copy — must be revised, not deleted |
| | 26 Failed | Odo concerned, "Couldn't process", "recording is safe on this phone", Try again + Keep audio | `EmptyState` shape | Failure face | S | Low |
| | 27–30 Verification | Bento (tooth / fees / next sitting); **medicines become a full-width n-scalable list**, not a tile; conflict = crit inset rail + red drug name + one factual line + inline Swap; findings/procedure become a `.paper` block (16.5px/1.7, hairline left rule); `⟨verify⟩` amber chip jumps the cursor; sticky `.cta` locked until the rail clears | `useConsultStore`, `lib/consult/editors`, `safety-view`, `hasUnresolvedBlocking` | `VerificationCard` (545 lines) presentation | **XL** | Safety-critical. 5 regression tests touch this file. The 7-medicine case (frame 29) is an explicit layout requirement |
| | 31 Saved | Odo celebrating, three outcome chips (Rx / bill / booking), "Call next" `.cta` | `MascotMoment` | Success beat | S | 1.2s auto-advance timing |

### E · Patients & cases

| Route | Frame | Visual changes | Reuse | Rewrite | Complexity | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/patients` | 32, 33, 34 | 28px title + search/＋ circles; filter `.gchip` row (All/Today/Treating/₹Due); `.vrow` glyph rows: 44px status-ring avatar, name, `.mini` glyph strip (tooth · sitting dots · dues), trailing `.statdot`. Search morphs the header; matches highlight lime-soft; no-match converts to intake | `useQueueStore`, patient queries, `VoiceSearchInput` | Row, header, search, empty | L | Ring color = status; needs a single mapping helper |
| `/patients/new` | 35, 36 | Voice-first `.card.wash` hero; `.frm-lb` + `.frm` fields; **`.frm.voiced` = 3px lime inset spine that fades on first touch**; flags as toggle `.gchip`s; sticky `.cta` unlocked by name+phone | RHF+Zod schema, `VoiceInput`, all intake logic | Field chrome, voiced-state | L | 3 regression tests on intake shape/queue/blood-group |
| `/patients/[id]` | 37, 38, 40, 41 | Centered 72px lime-ring avatar identity block; 3 stat cards; `.cta` Record findings + phone/Rx circles; **`.ptabs`** (inset pill group, white active pill); per-tab bodies rebuilt | All queries/mutations, `Odontogram`, `BillSheet`, `PrescriptionSheet`, `NewVisitSheet` | Header, tabs, every tab body | **XL** | 958 lines, 5 tabs, 6 sheets. **Media tab is app-only** — keep it (§6.3) |
| `/patients/[id]/plans/[planId]` | **39** | The canonical "case" page: patient card → record, fees bento with progress bar, NEXT tile, sittings `.vrow`s (each → its visit record), Linked lab + Rx rows | Plan queries | Page body | L | Frame 39 is where every "RCT 36" text in the app must land — a link-audit is part of this |
| — | 42 History timeline | **Spec-only** as a page (Odo-mood spine). App shows records inline on Overview | — | — | — | §6.2 |
| sheet | 43 Visit record | Read-only sheet: 3 `.stat` pills, `.prose` block, Amend / Share PDF, "originals never change" | `BottomSheet` | Sheet body | M | Amend is append-only — logic exists |

### F · Prescriptions

| Surface | Frame | Visual changes | Reuse | Rewrite | Complexity | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `PrescriptionSheet` | 44, 45 | Each medicine = `.medcard` with lav Rx glyph, 16px name, **●○● dose dots** + duration; dashed "Add medicine"; dot legend once above the CTA; one lime "Save & share PDF". Conflict = crit outline + inline Swap/Remove, Share locked | `useCreatePrescription`, template apply, PDF fetch, safety check | Sheet body, medicine row | L | Same guardrail as verification — must behave identically |

### G · Schedule

| Route | Frame | Visual changes | Reuse | Rewrite | Complexity | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/schedule` | 46, 47, 49 | `.seg` Day/Week/Mo; `.week` strip (lime capsule + glow on today); timeline with hairline hour rules, `.appt` blocks with 3.5px state bar, dashed `.slot-hint` free slots, hatched `.lunch`, lime `.nowline` with a dot. Reception = 2 columns + shared now-line + per-doctor off-shading. Drag = tilt + big shadow + dashed lime drop target + confirm bar | `DayView`, `MultiDoctorDay`, `WeekStrip`, `SlotPicker`, all schedule queries | Block, slot-hint, week strip, now-line chrome | L | Drag-to-reschedule (frame 49) may not exist yet — verify before promising |
| `NewAppointmentSheet` | 48 | Search `.frm` with ✓, doctor `.seg`, free-slot `.gchip` row from real availability, procedure `.frm`, `.cta` "Book · Tue 11:45" | Sheet logic, availability query | Sheet body | M | Only real free slots may be offered |

### H · Reception & money

| Route | Frame | Visual changes | Reuse | Rewrite | Complexity | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/today` | 50, 53 | Eyebrow with `● LIVE`; **money bento pair** (Collected / Pending) replaces the 4+3 StatTile grids; "Clinic now" grouped per doctor+chair with `Rec` do-not-disturb chip; Checkout `.vrow`s with lime amount chips. Payment success = toast with 6s Undo, numbers tick up behind | `useQueueStore`, `useTodayStats`, `useDailyCollection`, `ActivityFeed`, all sheets | `StatTile` grids → bento, rows, toast | L | `collectionStatTiles` returns 4 tiles; spec shows 2 + a stat row — mapping needed, not deletion |
| `WalkInSheet` | 51 | Search-first, inline "＋ New person" row, doctor `.seg`, `.cta` | All logic | Sheet body | S | Low |
| `CheckoutSheet` | 52 | `.kv` line items, hairline rule, **Payable = 30px, the biggest number on screen**, method `.seg`, `.cta` with amount | All logic | Sheet body | M | 1 regression test on items+total |
| `/billing` | 54 | Densified: one lime gradient hero holding the number + hourly `.bars` strip + cash/UPI `.stat` pills (three cards → one); by-doctor rows; live payment feed with refunds in crit; dues banner | Billing queries | Whole page | L | Refund sign/color |
| `/billing/outstanding` | 55 | Crit bento total + patient rows with Remind chips | Queries | Page | S | Consent-gated Remind must stay gated |

### I · Lab

| Route | Frame | Visual changes | Reuse | Rewrite | Complexity | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/lab` | 56, 57 | **`.stat` pills, not tiles** (Active / Overdue / Ready); filter `.gchip`s; `.vrow`s with LB-id, tooth/type/vendor `.mini`s, right-aligned status + stage. ＋ opens its own dial (New case lime, Message a lab, Add vendor) | `lab-queries`, `lab-ui` | Header, stats, rows, ＋ dial | M | Lab is the only list with a ＋ dial — everything else is a direct ＋ |
| `/lab/[caseId]` | 58 | 6-step `.jy` journey rail; `.cta` "Mark ready" + Message/Raise issue; material/margin bento; photo strip; history `.kv`s with Undo | All logic, media | Page body | L | Journey grammar is shared with sittings |
| `/lab/new` | 59 | Spec makes it a **sheet**; app has a page. Keep the page, apply the sheet's field language (`.frm-lb` + chip rows for type/tooth/vendor/due, cost/charge `.stat` pair) | All logic | Page body | M | §6.3 |
| consent | 60 | "Will send" preview card, consent toggle, CTA locks when off | `whatsapp-consent` logic | Sheet body | S | DPDP — behaviour must not change |
| `/lab/vendors` | 61 | Vendor `.vrow`s with consent/on-time/turnaround `.mini`s; 90-day performance bento | Queries | Page | M | Masked phone + Reveal must stay |
| `/lab/[caseId]/edit` | — | **App-only.** Restyle in the same language | All logic | Chrome | S | Low |

### J · Messages

| Route | Frame | Visual changes | Reuse | Rewrite | Complexity | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/messages` | 62 | Filter `.gchip`s; rows = 46px avatar, name, truncated preview, time + **category dot + unread lime dot** (no label spam); Lab-inbox entry row | Queries | Rows, header | M | Low |
| `/messages/[conversationId]` | 63, 64 | `.bub` in/out with tails, read receipts, window-countdown pill, agreed-time "Book …" chip; window closed → composer swaps to a template rail with the 24h rule explained | All logic, template picker | Bubbles, composer | M | The window rule is business logic — presentation only |
| `/messages/lab` | 65 | Three quiet verdict cards: ✓ Applied (+Undo) / Suggested (one-tap apply) / Link. **Zero "AI" labels** | `lab-inbox-queries` | Cards | M | Copy change: strip any AI framing |
| — | 66 Follow-ups | **Spec-only** as a page. `follow-up.ts` exists API-side; no web route | — | — | — | §6.2 |

### K · Inventory

| Route | Frame | Visual changes | Reuse | Rewrite | Complexity | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/inventory` | 67 | Three mic `.gchip`s (Purchase/Usage/Count); "Low stock" section in warn; all-items `.vrow`s with right-aligned counts | `inventory-queries`, `inventory-ui` | Page body | M | Count is admin-gated — keep |
| `/inventory/[itemId]` | 68 | Stock/price bento, Purchase/Consume/Adjust buttons, movement `.kv` ledger with signed colored deltas | All logic | Page body | M | Adjust admin-only + reason |
| voice sheets | 69 | **The parse→confirm contract**: "Heard you" + italic transcript + `.kv` parsed fields + "Tap any line to fix it" | `inventory-voice` (tested) | Sheet body | S | This frame is the template for all v10 voice writes |
| `/inventory/new`, `/inventory/categories` | — | **App-only.** Restyle | All logic | Chrome | S | Low |

### L · Management

| Route | Frame | Visual changes | Reuse | Rewrite | Complexity | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `/more` (**new**) | **70** | 2×2 module bento with live counts + attention chips; `.set-row` settings list with 32px tinted icons | `useNeedsYou`-style counts | New page | M | §6.1 decision |
| `/clinic` | 70 (partial) | Currently the doctor's 5th tab. Becomes a section reached from More; restyle to `.set-row` list | All links | Page body | S | Route preserved |
| `/clinic/whatsapp` | 72 | Connected card, automatic-message toggles, budget bar + 6-month `.bars` | `whatsapp-settings` | Page body | M | Low |
| `/clinic/availability` | 73 | Doctor `.seg`; per-day `.set-row` with lime time-range `.mini`s + ＋; "Copy Monday to weekdays" | All logic, `TimeInput` | Page body | M | Low |
| `/clinic/day-off` | 74 | Scope `.seg`, date+reason `.frm` pair, `.cta`; upcoming rows with tinted icons + ✕; warn card about existing bookings | All logic | Page body | S | Booking-conflict guard must stay |
| `/clinic/templates` | 75 | Search `.frm`; template `.vrow`s with meds-count/tag `.mini`s | All logic | Page body | S | Low |
| — | 71 Team & join code | **Spec-only** as a page | — | — | — | §6.2 |
| `ProfileButton` menu | **76** Account | Spec has a full Account *page* (profile card, switch role, clinic/professional details, language, notifications, privacy, sign out, version). App has a dropdown with logout only | `useAuth`, logout | Menu → page | M | §6.2 — partial; sign-out exists |
| — | 77 Switch role | **Spec-only** | — | — | — | §6.2 |

### M · System

| Surface | Frame | Notes |
| --- | --- | --- |
| Orb | 78 | Tap = context action (patient in chair → record; on Consult → record; elsewhere → Consult). **Hold 350ms = voice menu**, first row always naming who gets recorded. |
| Toasts | 79 | `lib/toast.ts` exists. Restyle to the three voices; add the 6s Undo affordance where reversible. **M** |
| — | 80 Notifications | **Spec-only** — no route, no endpoint. §6.2 |
| — | 81 Tap contract | Not a screen. Becomes a QA checklist item per page and a line in `docs/design-system.md`. |

### v10 · Talk to Odo

| Surface | Frames | Notes |
| --- | --- | --- |
| `VoiceInput` / `VoiceCommandHero` | 01–05 | App has single-shot capture + `routeVoiceCommand` intent routing. The spec adds: live transcript with entity lift; **parsed sheet** (intent chip + heard-text + structured `.pf` rows + one Odo follow-up); **done state** that stays listening with next-act chips; **correction state** (dotted warn underline on low-confidence tokens, candidate chips, re-say, spell-it); **"what can I say"** grammar sheet. |
| | | The *presentation* of 01/04/05 can be migrated onto existing capture + routing. States 02 (structured parse) and 03 (chained commands) need parser output the current intent router does not produce. **Recommend: migrate 01/04/05 presentation; treat 02/03 as spec-only.** §6.2 |

---

## 5. Component migration order

Nothing page-level starts until this list is done, in this order.

**Wave 0 — tokens** (`packages/ui/src/tokens.css`, `tailwind-preset.ts`, `globals.css`)
Pine ramp · alpha hairlines · retuned lime/canvas · four semantic pairs · crit ·
glass · radius ladder · pine-tinted elevation **with the white inner highlight** ·
type ladder · motion constants · `.amb` ambient wash. Existing token *names* are
retuned in place wherever possible so current consumers move coherently.

**Wave 1 — atoms**
`Button` (cta / btn2 / gchip-action, `.dis` state, press → `--lime-press` + scale .98) ·
`Badge` → **`Chip`** (`.gchip` 28px) and **`Mini`** (`.mini` 22px), each with the six
semantic tones · `Avatar` (+ the four status rings: lime / live / sky / none) ·
`Input`/`Field` (`.frm` 48, `.field` 56, `.frm-lb` label, **`.voiced` lime spine**) ·
`IconCircle` (`.icirc`) · `Toggle` (`.tg`) · `StatDot` · `DoseDots` (new) ·
`ProgressRing` (new) · `Segmented` (`.seg`) · `Waveform`.

**Wave 2 — surfaces**
`Card` (`.card` 26px + wash variant) · `BentoTile` (`.bt` + 4 tints) · `StatPill`
(`.stat`, new) · `QuickTile` (`.qt` + wide) · `HeroCard` → `.hero-c` · `GlassCard` →
spec glass · `PaperBlock` (`.paper`, new) · `Sheet`/`BottomSheet` (grab handle,
26px top radius, scrim) · `Dialog` · `ListRow` (`.vrow`) · `SettingRow` (`.set-row`) ·
`SectionHeader` (`.sec`) · `KeyValue` (`.kv`) · `Toast` (three voices).

**Wave 3 — navigation & domain**
`BottomTabs` → 4-tab glass pill · **`Orb`** (new: tap / hold-350ms / ring-highlight) ·
`SpeedDial` (`.dpill` stack, reusing `fabReducer`) · `VoiceMenu` (`.vmenu`) ·
`Tabs` → `.ptabs` · `JourneyRail` (`.jy`) · `VerticalJourney` (`.vj`) ·
`Timeline` (`.tl`) · `MedicineRow` (`.medrow` + crit rail) · `AppointmentBlock`
(`.appt`) · `WeekStrip` (`.wd`) · `SlotHint` · `Odontogram` cell (`.odn`) ·
`DayRiver` (new) · `ChatBubble` (`.bub`) · `Bars` · `Checklist` (`.chk`).

Only when every primitive matches does page migration begin, one page per commit,
in the §4 order (Entry → Setup → Home → Consult → Patients → Rx → Schedule →
Reception → Lab → Messages → Inventory → Management → System).

---

## 6. Decisions — RESOLVED

### 6.1 — Navigation ✅ **Add `/more` as tab 4**

New `/more` route renders frame 70 for both roles. Every existing route keeps its
path, its RBAC rule and its direct linkability. Nothing removed, nothing renamed.

| | Tabs | Orb |
| --- | --- | --- |
| Doctor | Flow · Patients · Schedule · **More** | mic |
| Reception | Today · Patients · Schedule · **More** | ＋ |

`/lab`, `/clinic`, `/billing`, `/messages`, `/inventory` are all reached from `/more`
and remain directly addressable. `canAccess()` in `lib/rbac.ts` gains `/more` as a
shared route; `RESTRICTED` is otherwise untouched.

### 6.2 — Spec-only frames ✅ **Build all 13 in this migration**

This overrides the brief's "never change API calls" rule for these frames only.
Everything already covered in §4 remains a strict presentation-layer migration.

Backend audit below (§6A) — the cost is far lower than feared: **4 of the 13 need no
backend at all**, and one (`Notification`) already has its Prisma model sitting unused.

### 6.3 — Where the spec *removes* something the app has ✅ **Keep everything**

Assumed from your own zero-regression rule; flagged for correction if wrong.

The spec is a redesign as well as a restyle, and in four places it deletes
functionality:

| App has | Spec says | Resolution |
| --- | --- | --- |
| `/clinic-create` 3-step wizard | Frame 08: one screen, hours/chairs as defaults, professional details moved to Account | **Keep all 3 steps**, restyle each in the frame-08 language |
| `/lab/new` full page | Frame 59: a sheet ("was a full page; a sheet keeps you in context") | **Keep the page**, adopt the sheet's field language |
| Patient detail **Media** tab | Frames 37–41 show 4 tabs; media folds into Teeth per-tooth | **Keep 5 tabs**, style as `.ptabs` |
| `/clinic/day-off` page | Frame 19: a quick sheet from the Home header | **Keep the page**; frame 19's sheet is added as an *additional* entry point from the Home header |

### 6.4 — Two locked design rules the spec contradicts ✅ **Adopt the spec's rules**

`docs/design-system.md` §12.1 bans, with passing regression tests:

- **`no-wash-on-app-routes`** — no gradient wash on `(app)/*`. The spec puts the `.amb`
  ambient wash on **every** frame including Home, Patients, Schedule, Lab and Billing.
- **`no-mascot-on-home`** — no mascot on working screens. The spec puts Odo on Home
  (15, 16, 17), Consult empty (22), Processing (25), search-no-match (34), the Cases
  journey (38) and the history timeline (42). The spec's *own* mascot law bans Odo only
  from verification, prescriptions, checkout and billing — i.e. money and safety.

Both tests will fail. Resolution: adopt the spec's rules, rewrite `docs/design-system.md`
§12.1, and repoint both tests at the spec's boundaries — wash allowed app-wide at spec
opacity; mascot banned on verification / Rx / checkout / billing (money and safety), the
spec's own law. The guardrails stay; only their target moves.

| Test | Fate |
| --- | --- |
| `no-wash-on-app-routes` | **Repoint** → assert `.amb` opacity is within spec range on `(app)/*`, and that no *other* gradient wash is used |
| `no-mascot-on-home` | **Rename + repoint** → `no-mascot-on-money-or-safety`: verification, prescription sheet, checkout, billing |
| `progress-strip-copy` | **Rewrite** — frame 25 replaces the 3-step strip with Odo + one bar + "Usually under 20 seconds" |
| `bottom-tabs-active-only-label` | **Keep**, update dimensions (52px capsule, 20px icon, 13.5px/800 label) and tab count 5→4 |

### 6.5 — Typeface ✅ **Keep Geist, adopt the spec's type ladder**

Geist Sans and Geist Mono stay (one typeface on every device). Sizes, weights
(650/750/800), tracking (`-.03em` display → `+.12em` eyebrows) and `tabular-nums`
follow the spec exactly.

---

## 6A. Backend scope for the 13 spec-only frames

Audited against `apps/api/src/routes/*` and `packages/db/prisma/schema.prisma`.

### Needs no backend (4)

| Frame | Why | Web work |
| --- | --- | --- |
| **12** First-day checklist | Derivable: clinic from `/auth/me`, first patient from `GET /patients`, hours from `GET /availability/doctor/:id`, team from frame 71's members list | New `/first-day` surface + a dismissed-flag in `ClinicSetting` |
| **42** History timeline | `GET /patients/:id/visits` · `/plans` · `/prescriptions` · `/billing` all exist — merge and sort client-side | New page + `Timeline` component |
| **43** Visit record sheet | `GET /visits/:id` exists; Amend is `PATCH /consultations/:id` and `ConsultationEdit` already models append-only edits | Sheet body only |
| **v10-03** Chained commands | Pure client orchestration on top of v10-02 | Queue + sequential execute in the voice store |

### Small backend (1–2 endpoints each)

| Frame | Exists | New |
| --- | --- | --- |
| **10** Pending approval | `ClinicMember.status` defaults to `PENDING`; `POST /clinics/join` already creates it. `/auth/me` returns `null` because `findActiveMembership` filters to ACTIVE | Extend `/auth/me` to also return a pending membership (preferred — no new route), + client poll |
| **20** Week in review | `/reports/daily-collection` is single-day only | `GET /reports/weekly` — patient count + WoW delta, collected + dues, per-day counts, confirmed-record streak |
| **76** Account page | `/auth/me`, `/auth/logout`; `ClinicMember` already carries `qualification`, `registrationNumberEnc`, `specialization`; `ClinicSetting` exists for language | `PATCH /clinics/members/me` (professional details, encrypted field already modelled) |
| **77** Switch role | Schema allows multiple `ClinicMember` rows per user; the app assumes exactly one | `GET /clinics/memberships`, `POST /auth/switch-membership` |
| **v10-02** Structured parse | **Better than expected** — `/dictate/*` already has 10 intent-specific endpoints (intake, walk-in, prescription, inventory ×3, lab case, bill items, appointment) and each returns structured fields | `POST /dictate/parse` to classify intent then dispatch — or do the classification client-side and reuse the 10 existing endpoints unchanged (**preferred**) |

### Medium backend (3–5 endpoints)

| Frame | Exists | New |
| --- | --- | --- |
| **71** Team & join code | `Clinic.joinCode`, `ClinicMember` with `status` + `isAdmin` | `GET /clinics/members`, `POST /clinics/members/:id/approve`, `.../reject`, `PATCH /clinics/members/:id` (role), `POST /clinics/join-code/rotate` |
| **80** Notifications | **The `Notification` model already exists in the schema with zero usage** — no routes, no writers | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all` + write sites at 4 event sources: payment received, lab status change, inbound message, follow-up overdue |

### Largest items (new model)

| Frame | Reality | New |
| --- | --- | --- |
| **66** Follow-ups | `lib/schedule/follow-up.ts` is a **slot resolver** for voice-dictated follow-ups, not a task list | **Revised after your challenge** — the list *derives* from `Prescription.reviewAfterDays` + completed `Procedure`s + fitted `LabCase`s. Only the resolution needs storage: one 8-column `FollowUpResolution` table + 2 endpoints. No generation job, no cron, no backfill. Full reasoning in **Doc 3 §4.2** |
| **06** Device unlock | `/auth/refresh` + `/auth/me` exist | **PIN only.** WebAuthn descoped pre-launch (your call — browser inconsistency and support burden outweigh the MVP security delta). Local PIN gates the existing 12h refresh cookie; 1 endpoint |

**Backend total:** ~16 new endpoints, **1 small new table** (`FollowUpResolution`, 8
columns), 4 notification write-sites, 1 extension to `/auth/me`. No new `FollowUp`
model, no `WebAuthnCredential` model. No existing endpoint changes shape, so nothing
in §4 regresses.

---

## 6C. The three planning documents

Per your request, these are complete and supersede the summary tables above:

| Doc | File | Contents |
| --- | --- | --- |
| **1** | [`migration/01-feature-matrix.md`](migration/01-feature-matrix.md) | All **232 features** across 21 areas → frame · implemented · missing · backend · UI · regression risk. 178 ✓ · 30 ⚠ · 24 ✗ · 60 high-risk touchpoints |
| **2** | [`migration/02-component-mapping.md`](migration/02-component-mapping.md) | All **76 components** → REUSE / MODIFY / REPLACE / NEW, with API-change column. 21 · 52 · **3** · 24. Every REPLACE cites the frame that mandates it |
| **3** | [`migration/03-visual-migration-plan.md`](migration/03-visual-migration-plan.md) | Per-page plan: frame · components · backend · risk · effort · screenshot slug. Plus the screenshot harness, the expanded Stage 0, and the answers to the Notification-files and Follow-up-model questions |

---

## 7. Sequencing

Migration of existing screens (stages 0–13) comes first and is pure presentation.
The 13 spec-only frames land afterwards (stages 14–17) so no new backend work can
destabilise the restyle.

| Stage | Content | Commits |
| --- | --- | --- |
| 0 | Token layer + `design-system.md` §12.1 rewrite + 4 test updates (§6.4) | 1 |
| 1 | Wave-1 atoms | 3–4 |
| 2 | Wave-2 surfaces | 3–4 |
| 3 | Wave-3 navigation + domain components (incl. the orb) and `/more` (frame 70) | 4–5 |
| 4 | Entry + Setup pages (A, B) | 8 |
| 5 | Home / Flow (C) | 2 |
| 6 | Consult pipeline (D) | 5 |
| 7 | Patients & cases + Rx (E, F) | 6 |
| 8 | Schedule (G) | 2 |
| 9 | Reception & money (H) | 5 |
| 10 | Lab (I) | 6 |
| 11 | Messages (J) | 3 |
| 12 | Inventory (K) | 4 |
| 13 | Management + System toasts (L, M) | 7 |
| **14** | **No-backend frames:** 12, 42, 43, v10-03 | 4 |
| **15** | **Small-backend frames:** 10, 20, 76, 77, v10-02 — endpoint + web page per commit | 10 |
| **16** | **Medium-backend frames:** 71 (5 endpoints), 80 (3 endpoints + 4 writers) | 6 |
| **17** | **New-model frames:** 66 Follow-ups, 06 Face ID | 6 |

One page per commit. Every page commit runs `pnpm verify` plus the §8 checklist
before the next one starts. Stages 14–17 additionally require API tests for every
new endpoint before its web surface is built.

---

## 8. Per-page validation checklist

Run against every migrated page before moving on:

✓ Visual parity with its frame (layout, spacing, radius, shadow, type, icon sizes)
✓ Every interactive element from the previous version still present and working
✓ Navigation in and out unchanged · ✓ Forms submit and validate identically
✓ Voice workflow intact where present · ✓ Keyboard/focus order preserved
✓ Loading, empty, and error states all present and restyled
✓ Responsive down to 360px and up to `--max-width-mobile`
✓ Accessibility: labels, `aria-current`, focus rings, 44px minimum targets, `sr-only`
  labels on icon-only controls, reduced-motion honoured
✓ **Tap contract (frame 81):** tap everything — anything inert without a stated reason
  is a bug
✓ `pnpm lint typecheck test` green, including regression tests

---

## 9. Risk register

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | Token retune silently breaks unrelated screens | Retune existing token *names* in place; Stage 0 lands alone and the whole app is walked before Stage 1 |
| 2 | `VerificationCard` (545 lines, safety-critical, 5 regression tests) | Presentation-only edit; safety logic stays in `lib/consult/*`; tests must stay green untouched |
| 3 | `patients/[id]` (958 lines, 5 tabs, 6 sheets) | Split into tab components first as a pure refactor with tests green, then restyle each |
| 4 | Navigation change disorients existing users | §6.1 decision first; no route renamed; every destination stays directly linkable |
| 5 | The four semantic color inversions applied ad-hoc | One shared tone helper feeding Chip / Mini / Stat / Bento; no per-site color classes |
| 6 | The spec's five Home states (13–17) are data-driven | Each state must derive from real queue/schedule/network state — no mock toggles |
| 7 | Glass budget (currently ≤4 surfaces/screen for perf) | Spec uses glass only on the nav and the voice menu — budget holds; document it |
| 8 | New backend work (stages 14–17) destabilising the restyle | Sequenced strictly after stage 13; no existing endpoint changes shape; every new endpoint gets API tests before its web surface |
| 9 | Recording / offline behaviour regressing | `useConsultStore` machine untouched; only the `Recorder` face changes; manual offline pass on frames 17, 23, 24, 26 |
| 10 | ~~`FollowUp` generation firing on historical data~~ | **Eliminated** — the derive-plus-resolutions design has no generation job at all (Doc 3 §4.2) |
| 11 | Notification writers double-firing | Idempotent on `(userId, type, payload.entityId)`; 3 of the 4 write sites are already inside a Prisma transaction; badge clears on visit per frame 80 |
| 12 | Switch-role assumes one membership app-wide | `findActiveMembership` and every `clinicId` scope audited before stage 15 |
| 13 | **Structural loss going unnoticed** (a row, button or section silently vanishing) | Screenshot baseline captured **before** Stage 0; every page commit runs `shots:current` + `shots:compare` and the diff is read for structural loss, not just visual change |

---

## 10. Status

**All decisions resolved.** WebAuthn descoped; frame 06 is PIN-only.

**Three planning documents complete** (§6C). Awaiting approval of those before
Stage 0 begins.

Stage 0 = design system only (16 token groups, Doc 3 §2) + `design-system.md` §12.1
rewrite + 4 test repoints + the screenshot harness. No component, no page. Then commit.
