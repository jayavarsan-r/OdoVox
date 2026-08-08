# Odovox UI migration — v9/v10 execution plan

Executes the complete visual migration of `apps/web` to the v9/v10 design language.
30 tasks. Stages 0–1 (tokens + Wave-1 atoms) are already committed and tagged; this
plan covers everything after them.

**Source specs (design only — never copy their HTML/CSS/DOM):**
`odovox-v9-master.html` (81 frames) · `odovox-v10-talk.html` (5 frames)

**Reference documents — read the relevant rows, not the whole file:**

- `docs/migration/01-feature-matrix.md` — 232 features → frame, status, risk
- `docs/migration/02-component-mapping.md` — 76 components → reuse/modify/replace/new
- `docs/migration/03-visual-migration-plan.md` — per-page plan
- `docs/migration/04-migration-governance.md` — QA checklist, perf budgets, done-criteria
- `docs/design-system.md` §12 — the forbidden-patterns law (rewritten for v9)

---

## Global Constraints

These bind every task. A violation is a failed review regardless of the task's own spec.

### Feature parity is absolute

1. **No existing feature, workflow, route, modal, sheet, form, or interaction may
   disappear.** Not one. If a feature has no frame in either spec, redesign it in the
   same visual language — never remove, hide, or stub it.
2. **Never change business logic, API calls, state management, query keys, or routes**
   in a migration task. Presentation layer only. The two refactor tasks (17, 21) are
   the sole exceptions and they must produce a **zero-pixel screenshot diff**.
3. Loading, empty, and error states are features. Each must survive and be restyled.

### Tokens only

4. **No hex literals, no magic px, no ad-hoc shadows.** Everything from
   `packages/ui/src/tokens.css` via Tailwind utilities. The one documented exception is
   `qrcode.react` on `/done`.
5. Every raised surface carries its top highlight (`--highlight-top`). A flat raised
   surface is a defect.
6. Muted text and rules are **alpha over pine** (`text-pine-2`, `text-pine-3`,
   `border-hair`). Never a neutral grey.
7. Legacy pastel tokens (`sage`, `peach`, `lavender`, `--color-sky`) still exist. When a
   task touches a call site, migrate it to the canonical pair
   (`sky/sky-soft`, `live/live-soft`, `warn/warn-soft`, `lav/lav-soft`, `crit/crit-soft`)
   and report the remaining count for that token.

### The v9 laws

8. **Crit (`--crit`) means "act now" and nothing else.** A 3.5px inset left rail on the
   offending row + the red name + one factual line. Never a pink wash, never a banner,
   never an "AI" voice.
9. **A lone number never gets a bento tile** — it gets a 46px `.stat` pill. Tiles are for
   content with structure.
10. **The tap contract (frame 81):** if it names a thing, it opens that thing; if it shows
    a number, it opens where the number comes from; if it can't be tapped, it gets no
    chevron. No dead ends.
11. **Glass on exactly two surfaces** app-wide: the nav pill and the voice menu.
12. **Mascot is banned on money and safety only** — verification, prescription sheet,
    checkout, billing. It is now _allowed_ on working screens (see `design-system.md` §12.1).

### Performance (governance §2)

13. Animate `transform` and `opacity` only. Never `box-shadow`, `background`, or gradients.
14. No nested backdrop filters. Max two blurred surfaces on screen.
15. No glass on lists or repeating items.

### Accessibility

16. Every interactive element ≥44×44 (`--target-min`). Icon-only controls carry
    `sr-only` labels. Focus rings use `--ring-lime`. `prefers-reduced-motion` swaps every
    animation for an instant state change.

### Definition of done, per task

17. `pnpm --filter @odovox/web lint` → 0 errors
18. `pnpm --filter @odovox/web typecheck` → 0 errors
19. `pnpm --filter @odovox/web test` → 0 failures (369 passing at plan start; new pure
    logic in `lib/ds/` or `lib/**` needs its own tests)
20. Commit with the migration report format from `docs/migration/04-migration-governance.md` §6

### Verification the controller owns — do NOT attempt it

21. **Do not run `next build` or `pnpm build`.** It shares `.next` with the running dev
    server and corrupts it (governance §5.1).
22. **Do not run screenshot capture or comparison** (`shots:baseline`, `shots:current`,
    `shots:compare`). One dev stack is shared; the controller runs the visual gate after
    your commit and will return findings if a diff shows structural loss.
23. **Do not run the API test suite** (`@odovox/api`) — it takes ~69 minutes and shares
    the database with the screenshot stack.

### Toolchain

24. This repo needs Node 20 and its pinned pnpm. Prefix commands with:
    `eval "$(fnm env)" && fnm use 20 >/dev/null &&`

---

## Task 1: BentoTile and StatPill surfaces

Build the two v9 surfaces that carry every number in the app.

**`BentoTile`** — new, `apps/web/components/ds/bento-tile.tsx`. Spec `.bt`:
radius `--radius-2xl` (24px), padding 16px, `shadow-tile`.
Label `.bl`: 10px, weight 800, tracking `--tracking-bento-label` (.08em), `text-pine-3`.
Value `.bv`: 23px, weight 800, tracking `-.02em`, `tabular-nums`, margin-top 3px.
Tone variants: `neutral` (white), `lime` (`--grad-tile-lime`), `sky` (`bg-sky-soft`),
`crit` (`bg-crit-soft`), `live` (`bg-live-soft`), `warn` (`bg-warn-soft`).
Tinted tones colour their label and value to the matching saturated token.
Prop `span={1|2}` → `w2` spans both grid columns.

**`StatPill`** — modify `apps/web/components/ds/stat-tile.tsx`. Spec `.stat`:
46px tall, inline-flex, gap 9px, padding 0 15px, radius `--radius-sm`-ish 17px,
`shadow-stat`. Value 19px/800 `tabular-nums`; label 10px/800 tracking .07em `text-pine-3`.
Tones: default white, `crit`, `live`, `lime-soft`.
**Add `shape="pill" | "tile"`, default `pill`** — do not remove the existing `variant`
or `size` props; existing call sites in `/today` and `/lab` must keep compiling.

Export both from `components/ds/index.ts`.

**Why:** Global Constraint 9 — a lone number gets a pill, structured content gets a tile.
These two components are what make that law enforceable.

**Verification:** lint, typecheck, test. No page adopts them in this task.

---

## Task 2: ListRow, SectionHeader, SettingRow, KeyValue

The four repeating surfaces. `.vrow` alone appears on nearly every v9 list frame.

**`ListRow`** — new, `components/ds/list-row.tsx`. Spec `.vrow`: flex, align center,
gap 13px, padding 11px 18px; adjacent rows separated by `border-t border-hair`
(use `[&+&]:border-t` or a parent `divide-y divide-hair`).
Name `.vr-name`: 15.5px/700, line-height 20px.
Glyph strip `.vr-glyphs`: flex, gap 6px, margin-top 5px, wrap — holds `<Mini>` badges.
Props: `leading` (avatar/icon), `title`, `glyphs`, `trailing`, `onClick`, `dimmed`.
When `onClick` is set it renders a `<button>` with `active:bg-[rgba(31,42,35,0.03)]`
(the spec's 3% pressed wash) and 44px minimum height.

**`SectionHeader`** — new, `components/ds/section-header.tsx`. Spec `.sec`:
flex, space-between, padding 20px 20px 9px. Title `.sec-t` 14px/800;
action `.sec-a` 13px/700 `text-pine-3`. Action is optional and, when given `onClick`,
is a button.

**`SettingRow`** — new, `components/ds/setting-row.tsx`. Spec `.set-row`:
flex, gap 12px, min-height 52px, padding 0 16px, `border-t border-hair` between rows.
Icon `.set-ic`: 32px, radius `--radius-xs` (11px), tinted. Title `.set-t` 14.5px/600 flex-1.
Value `.set-v` 12.5px/700 `text-pine-3`. Optional trailing chevron or `<Toggle>`.

**`KeyValue`** — new, `components/ds/key-value.tsx`. Spec `.kv`:
flex, space-between, padding 11px 18px, `border-t border-hair` between rows.
Key 13.5px/500 `text-pine-2`; value 13.5px/800 `tabular-nums`.

Export all four from `components/ds/index.ts`.

**Verification:** lint, typecheck, test.

---

## Task 3: QuickTile, PaperBlock, Card wash

**`QuickTile`** — new, `components/ds/quick-tile.tsx`. Spec `.qt`:
white, radius `--radius-xl` (22px), padding 12px 13px, `shadow-quick-tile`,
flex row, gap 11px, min-height 68px, position relative.
Icon `.qi`: 40px, radius `--radius-sm` (14px), tinted background + saturated icon.
Title 15px/800 tracking `-.015em`; subtitle 11.5px/650 `text-pine-2` line-height 1.35.
Optional badge top-right (`.bdg`, absolute top 9 right 11).
Variant `wide`: spans 2 grid columns, min-height 58px, radius 19px,
background `--grad-tile-warn`, icon block white with a warn-tinted shadow.

This currently exists as a private function inside `app/(app)/home/page.tsx` — move it
out (this is the REPLACE in `02-component-mapping.md` §16, a relocation, not a rewrite)
and leave `/home` importing it. `/home`'s appearance must not change in this task.

**`PaperBlock`** — new, `components/ds/paper-block.tsx`. Spec `.paper`:
margin 15px 20px 0, padding-left 15px, `border-l-[2.5px] border-[#DCE3CE]`.
Section label: 10.5px/800, tracking `--tracking-eyebrow` (.12em), `text-pine-3`.
Body: **`--prose-record-size` (16.5px) / `--prose-record-leading` (1.7)**, weight 500,
`text-pine`. This is the chair-side legibility rule — clinical record text everywhere.
Also export `VerifyChip` for the `⟨21 mm · verify⟩` inline token: `bg-[#FFF6E8]`,
radius 6px, padding 1px 7px, weight 800, `text-warn`, 14px, `whitespace-nowrap`.

**Card wash** — modify `components/ui/card.tsx`: radius `--radius-3xl` (26px),
`shadow-card`, and **add a `wash` boolean** rendering the spec's `.card.wash::before`
— an absolutely positioned 210px circle at `right:-70px top:-70px`,
`background: var(--wash-lime-corner)`, `pointer-events-none`, with the card
`overflow-hidden`. Do not change the existing Card sub-components' APIs.

**Verification:** lint, typecheck, test. `/home` must still compile and render the same.

---

## Task 4: Sheet, Dialog, and the three toast voices

**Sheet surfaces** — modify `components/ui/bottom-sheet.tsx`, `components/ui/sheet.tsx`,
`components/ui/dialog.tsx`. Spec `.sheet`: `bg-sheet` (`#FDFDFB`),
`rounded-t-[26px]`, padding 8px 18px 16px, `shadow-sheetShadow`
(`0 -10px 36px rgba(31,42,35,.22)`).
Add the grab handle `.grab`: 36×5px, radius 3px, `bg-hair-2`, centred, margin-bottom 12px.
Scrim `.scrim`: `bg-[rgba(31,42,35,0.42)]`.
Title `.sh-title` 19px/800; subtitle `.sh-sub` 13px `text-pine-2` margin-top 2px.
Keep every existing prop and the drag/close behaviour.

**Toast** — modify `apps/web/lib/toast.ts` and add `components/ds/toast.tsx` if a custom
renderer is needed (the app uses `sonner`). Spec frame 79 defines **exactly three voices**:

- **success** — 4s auto-dismiss, `bg-[#FDFEFA]`, radius 22px, `shadow-toast`,
  40px `live-soft` icon circle with a check, **and an Undo affordance wherever the action
  is reversible** (`--duration-undo` = 6000ms).
- **problem** — sticky until acted on, same surface plus `outline-2 outline-crit`,
  `crit-soft` icon circle with an alert, and a Retry action.
- **offline** — persistent, calm, no outline, muted icon circle.

One at a time, bottom-anchored above the nav, newest wins.

**Verification:** lint, typecheck, test. Add a unit test for the toast-variant selection
logic if you introduce any (put pure logic in `lib/`).

---

## Task 5: Orb and NavDock — the navigation restructure

The one structural change in the migration. **Highest risk task in the plan.**

**`Orb`** — new, `components/ds/orb.tsx`. Spec `.actbtn`:
66px (`--target-orb`), round, `bg-orb` (`--grad-orb`),
`border border-white/90`, `shadow-orb`, icon 26px (`--icon-orb`).
`::after` ring: `inset -6px`, round, `border-[1.5px] border-[rgba(205,231,99,0.45)]`.
Behaviour:

- **tap** → context action (prop `onTap`)
- **hold 350ms** (`--hold-threshold`) → `onHold`, for the voice menu
- prop `active` adds the extra 4px `lime-soft` ring the spec shows when the orb's own
  tab is current (frame 21)
- pressed → scale .94
  Hold detection must not fire tap as well, must cancel on pointer-cancel/leave, and must
  work for touch, mouse, and keyboard (Enter = tap, long-press equivalent not required for
  keyboard — expose the hold action in the accessible name instead).
  Put the press/hold state machine in `lib/ds/orb.ts` **with unit tests** — timing logic
  is exactly the kind of thing that breaks silently.

**`NavDock`** — new, `components/ds/nav-dock.tsx`. Spec `.navwrap`:
absolute, left/right 16px, bottom 14px + `var(--safe-bottom)`, flex, gap 11px, z-70.
Composes `BottomTabs` (flex-1) + `Orb`.

**`BottomTabs`** — modify `components/app-shell/bottom-tabs.tsx`:

- **5 tabs → 4.** Doctor: Flow · Patients · Schedule · More.
  Reception: Today · Patients · Schedule · More.
- Spec `.lgnav`: height 72px (`--target-nav`), radius 36px (`--radius-nav`),
  `bg-glass`, `backdrop-blur-nav` + `saturate(1.9)`, `border border-glass-line`,
  `shadow-nav`. `::before` sheen: `inset 1px`, radius 35px, `bg-nav-sheen`.
- Active tab `.lgi.on .cap`: 52px (`--target-nav-capsule`), padding 0 20px, radius 26px,
  `bg-lime`, `shadow-cta`; label 13.5px/800 **next to** the icon, icon 20px.
- Inactive: icon only 22px, `text-[rgba(31,42,35,0.42)]`, label stays `sr-only`.
- **Keep** the `layoutId="tab-pill"` spring animation and the press-scale.

**`lib/rbac.ts`** — modify: replace the 5-tab arrays with the 4-tab ones and add `/more`
as a shared route in `canAccess`. **Do not change `RESTRICTED` otherwise, do not rename
any route, and do not remove `/lab`, `/clinic` or `/billing`** — they stay reachable by
URL and from the More hub (Task 6).

**`app/(app)/layout.tsx`** — modify: `TOP_LEVEL` gains `/more`; render `NavDock`.

Update the regression test `test/regression/bottom-tabs-active-only-label.test.ts` for
4 tabs and the spec dimensions. Its core assertion — label only on the active tab —
must survive.

**Verification:** lint, typecheck, test. Report the tab arrays for both roles.

---

## Task 6: The More hub — frame 70

New route `app/(app)/more/page.tsx`. Frame 70 exactly.

**Module bento** (2×2, `BentoTile`, gap 9px, `--gutter` 16px):
Lab · Messages · Inventory · Billing. Each tile: 38px tinted `IconCircle` (square, `asSpan`)
top-left, an attention marker top-right when relevant (`<Mini tone="crit">1 late</Mini>`,
a lime `StatusDot` for unread, `<Mini tone="warn">2 low</Mini>`), then a 15px/800 name and
an 11.5px/700 `text-pine-3` count line.

**Settings list** (`SettingRow` in a `Card`): WhatsApp (spend value) · Availability
(doctor count) · Days off (upcoming count) · Rx templates (count) · Team & join code
(a `<Mini tone="sky">` when requests are pending) · Account (user name).

**Header:** `EditorialHeading` title "More", trailing a clinic `<Chip>` with a building icon.

**Data:** reuse existing hooks only — `useNeedsYou`, `useTodayStats`, `useDailyCollection`,
the lab and inventory queries. **Create no new endpoint.** Where a count has no existing
source, omit the count line rather than inventing a query.

RBAC: reception must not see doctor-only destinations. Use `canAccess` — do not hand-roll
a role check.

Every row obeys Global Constraint 10 (tap contract).

**Verification:** lint, typecheck, test.

---

## Task 7: SpeedDial and VoiceMenu

**`SpeedDial`** — modify `components/ds/fab.tsx`. Spec `.dial` (frame 18):
absolute right 16px, **bottom 98px** so the stack sits above the orb; flex column-reverse,
gap 10px, align end, z-62.
Pill `.dpill`: white, height 54px, radius 28px, padding `0 7px 0 21px`, gap 13px,
`shadow-[0_16px_38px_rgba(31,42,35,0.2)]` + `--highlight-top`; label 15px/800 nowrap;
trailing 40px round tinted icon.
Stagger bottom-up at `--stagger-dial` (30ms). Scrim `rgba(31,42,35,.38)`. Orb rotates to ✕.
Closes on item tap, scrim tap, or Escape.
**`lib/ds/fab.ts` (`fabReducer`, `dispatchFabItem`) is already tested — reuse it unchanged.**

**`VoiceMenu`** — new, `components/ds/voice-menu.tsx`. Spec `.vmenu` (frame 78):
absolute right 16px bottom 96px, width 262px, `bg-glass-menu` (`rgba(253,254,250,.92)`),
`backdrop-blur-menu` + saturate, `border border-glass-line`, radius `--radius-2xl`,
padding 6px, `shadow-[0_22px_54px_rgba(31,42,35,0.3)]`.
Row `.vm-row`: flex, gap 11px, padding 11px 12px, radius `--radius-lg`;
`.hot` row is `bg-lime`. Label 13.5px/800; sublabel 10.5px/700 `text-pine-2` block.

**The first row always names who will be recorded** ("Start consultation — Anand Kumar ·
in chair"). This is a safety property, not copy: it is what prevents an accidental
recording against the wrong patient. If no patient is in the chair, the first row must
say so rather than defaulting silently.

Rows: Start consultation · New patient by voice · Book appointment · New lab case ·
Find a patient.

This is one of only two permitted glass surfaces (Global Constraint 11).

**Verification:** lint, typecheck, test.

---

## Task 8: DayRiver, journeys, and Timeline

**`DayRiver`** — new, `components/ds/day-river.tsx`. Spec `.dayriver` (frame 13):
flex, gap 5px, padding 11px 16px 0. Segment: flex-1, height 7px, radius 4px,
`bg-[#E9EDDE]`; `.f` filled = `bg-lime`; `.c` current = `bg-pine` with
`shadow-[0_0_0_3px_rgba(205,231,99,0.5)]`.
Caption `.dr-cap`: padding 7px 16px 0, 12px/750 `text-pine-2`.
Props: `total`, `done`, `currentIndex`, `caption`, `onSelect`.
One segment per appointment — lime = record confirmed, pine = in the chair now,
hollow = ahead. Tapping the river goes to Schedule (tap contract).
Put the segment-state derivation in `lib/ds/day-river.ts` **with tests** covering
zero appointments, all done, and a current index out of range.

**`JourneyRail`** — new, `components/ds/journey-rail.tsx`. Spec `.jy` (frame 58):
horizontal, 6 steps. Node `.jyd`: 22px round, `border-2 border-hair-2`, 10.5px/800;
`.done` = `bg-live border-live text-white`; `.now` = `bg-lime border-lime text-pine`
with `shadow-[0_0_0_4px_var(--lime-glow)]`.
Connector `.jyline`: absolute top 10px, left/right 9%, height 2px, `bg-hair-2`,
with a `bg-live` fill to the current step. Label `.jyl` 9.5px/700 `text-pine-2` centred.

**`VerticalJourney`** — new, `components/ds/vertical-journey.tsx`. Spec `.vj` (frame 38):
`::before` spine at left 11px, top 12px, bottom 14px, width 2px, `bg-hair-2`.
Step `.vjs`: flex, gap 13px, padding 8px 0. Title `.vjt` 14px/700;
subtitle `.vjsub` 12px `text-pine-2`.

**`Timeline`** — new, `components/ds/timeline.tsx`. Spec `.tl` (frame 42):
padding-left 38px; `::before` spine at left 13px, width 2.5px, `bg-[#E2E7D6]`, radius 2px.
Node `.tlnode`: absolute left 0, 28px round, white, `shadow-[0_4px_10px_rgba(31,42,35,0.12)]`.
Month label `.tlmon`: 10.5px/800 tracking .12em `text-pine-3`, margin 13px 0 7px.
Card `.tlcard`: white, radius `--radius-lg` (19px), `shadow-elev-1`, padding 11px 13px,
margin-bottom 9px.
Motion: spine draws over `--spine-draw` (350ms), cards stagger `--stagger-timeline` (45ms),
nodes pop last. **`prefers-reduced-motion` → everything appears static.**

**Verification:** lint, typecheck, test.

---

## Task 9: MedicineRow, AppointmentBlock, Checklist, Bars, Odontogram remap

**`MedicineRow`** — new, `components/ds/medicine-row.tsx`. Spec `.medrow` (frames 27–29).
This is the component that makes the 7-medicine case work: a full-width list row that
scales to n, **never a squeezed bento tile**.
Container `.meds`: white, radius `--radius-xl` (22px), `shadow-elev-1`, padding 3px 0.
Row: padding 10px 18px, `border-b border-hair` (last row none).
Name 14.5px/800 tracking `-.01em`; dose `<Mini>` right-aligned.
**Conflict state `.bad`:** `shadow-[inset_3.5px_0_0_var(--crit)]` — a **rail**, not a wash —
plus the drug name in `text-crit` and one factual line
(`.badline`: 12px/750 `text-crit`) stating _what_ the allergy is and _when_ it was
recorded, with the resolve action inline. **Global Constraint 8 — no banner, no wash,
no AI voice.**
Expanded state shows `<DoseDots>` + duration.

**`AppointmentBlock`** — new, `components/ds/appointment-block.tsx`. Spec `.appt`:
absolute-positioned, white, radius `--radius-sm` (14px), padding `8px 10px 8px 13px`,
`shadow-elev-1`, overflow hidden; `::before` state bar at left, width 3.5px, colour by
state (live / sky / hair-2). Title `.a-t` 13px/800 line-height 16px;
subtitle `.a-s` 11px `text-pine-2`. `.done` = 50% opacity.
Also export `SlotHint` (`.slot-hint`: dashed `border-[1.5px] border-hair-2`, radius 14px,
centred 11px/700 `text-pine-3`) and `LunchBand` (`.lunch`: `bg-hatch-lunch`, radius 12px,
10px/800 tracking .06em) and `NowLine` (`.nowline`: 2px `bg-lime`, radius 1px,
`shadow-[0_0_8px_var(--lime-glow)]`, with an 8px lime dot at its left end).

**`Checklist`** — new, `components/ds/checklist.tsx`. Spec `.chk` (frame 12):
flex, gap 11px, padding 11px 16px, `border-b border-hair`.
Done `.ok`: 26px round `bg-lime` with a check. Todo `.todo`: 26px round,
`border-2 border-dashed border-hair-2`.

**`Bars`** — new, `components/ds/bars.tsx`. Spec `.bars` (frames 54, 72):
flex, items-end, gap 8px, height 64px. Bar: flex-1, radius `6px 6px 3px 3px`,
`bg-lime-soft`; `.hot` = `bg-lime`. Optional axis labels below.
Stagger in at `--stagger-bars` (50ms); **animate `transform: scaleY` only, never height**
(Global Constraint 13).

**Odontogram remap** — modify `components/odontogram/odontogram.tsx`.
The current `TOOTH_TONE` map is **inverted vs the spec legend** (frame 40). Correct it:

| Status  | Current (wrong) | Spec                                               |
| ------- | --------------- | -------------------------------------------------- |
| RCT     | lavender        | **lime + `shadow-[0_0_0_2.5px_var(--lime-glow)]`** |
| CROWN   | lime            | **`bg-sky-soft border-sky text-sky`**              |
| CARIES  | peach           | **`bg-warn-soft border-warn text-warn`**           |
| MISSING | 40% opacity     | **transparent + dashed border**, still tappable    |

Cell `.odn i`: 19×24px, radius `6px 6px 8px 8px`, `border-[1.5px] border-hair-2`,
7.5px/800. Midline gap 8px between quadrants.
**The tooth-map regression test (`tooth-map-highlights-active-plans`) must still pass.**

**Verification:** lint, typecheck, test.

---

## Task 10: v10 atoms — the Talk-to-Odo surface

`odovox-v10-talk.html` contributes exactly **seven** classes beyond v9 (its `:root` token
block is byte-identical to v9's, so no new tokens are needed). Build all seven.

New file `components/ds/voice-atoms.tsx` (or one file each — your call, keep them together
if they stay small):

1. **`Wave`** (`.wave`) — flex, items-end, gap 3px, height 26px; bar width 3.5px,
   radius 2px, `bg-pine`. Driven by real amplitude. **Reduced motion → a static level bar.**
   Modify the existing `components/ui/waveform.tsx` rather than duplicating it if the shape fits.
2. **`Transcript`** (`.tsc`) — 19.5px, line-height 1.5, weight 750, tracking `-.015em`,
   `text-pine`. Recognised entities get a soft lime lift
   (`bg-lime-soft rounded-[5px] px-[3px]`). Not-yet-final words use `.ghost`
   (`text-pine-3` weight 650). Trailing caret.
3. **`IntentChip`** (`.intent`) — inline-flex, height 27px, padding 0 12px, radius 9px,
   `bg-pine text-lime`, 10.5px/800, tracking .09em, gap 7px.
4. **`ParsedField`** (`.pf`) — flex, gap 11px, padding 11px 16px, `border-b border-hair`.
   Label 10px/800 tracking .1em `text-pine-3`, fixed width 86px.
   Value 15px/800 tracking `-.01em`, flex-1.
   **Low-confidence value:** `border-b-[2.5px] border-dotted border-warn` on the token
   (`<em>` in the spec). Never silently guessed — this is the correction affordance.
   Optional trailing mic affordance or status `<Mini>`.
5. **`OdoBubble`** (`.obub`) — flex, gap 10px, items-start.
   Bubble: white, radius `5px 18px 18px 18px` (the tail is top-left), padding 11px 14px,
   `shadow-[0_7px_18px_rgba(31,42,35,0.08)]`, 14px/750 line-height 1.45.
   **This is the only surface in the product where Odo speaks — it was invited.**
6. **`SayChip`** (`.saychip`) — inline-flex, height 38px, padding 0 15px, radius 19px,
   white, `shadow-[0_6px_14px_rgba(31,42,35,0.08)]`, 13px/800. Primary variant `bg-lime`.
7. **`CmdRow`** (`.cmdrow`) — flex, gap 12px, padding 11px 16px, `border-b border-hair`.
   Icon 36px radius `--radius-sm` tinted. Title 14px/800 block;
   example 12px/650 `text-pine-2` **italic**.

Export from `components/ds/index.ts`.

**Verification:** lint, typecheck, test. No page adopts them in this task — frames
v10-01…05 land in Tasks 29–30.

---

## Task 11: Entry pages — frames 01–05

Migrate `app/page.tsx` (splash), `(onboarding)/welcome`, `(onboarding)/phone`,
`(onboarding)/otp`.

**Splash (01):** Odo 120px + wordmark 16px/800 tracking `--tracking-logo` (.18em) +
a 4px progress hairline (120px wide, radius 2px, `bg-hair-2` with a `bg-lime` fill).
**Replace the `Spinner`** — the spec is explicit that this screen has no spinner.
Keep the entire session-bootstrap and routing logic untouched.

**Welcome (02):** Odo 140px with sparkles, headline 29px/800 tracking `-.02em`
("Speak. / Odovox writes the record."), body `text-pine-2`, 3 `.ob-dots`
(6px, radius 3, `bg-hair-2`; active = 18px wide `bg-pine`), `.cta` "Continue with phone",
and the reassurance line 12px `text-pine-3`. Keep the embla carousel and Skip.

**Phone (03):** `.ob` layout, 22px gutters. Back `IconCircle` 40px.
Question `.ob-q` 27px/800; sub `.ob-s` 14px `text-pine-2`.
`Input size="hero"` with a `🇮🇳 +91` prefix separated by `border-r border-hair-2`,
a `.mic-a` affordance (38px, radius 13px, `bg-lime-soft`), and live 5-5 grouping.
`.cta` "Send code". The spec renders a keypad — **only build it if the current page
already has one**; otherwise keep the native keyboard and note the deviation.

**OTP (04, 05):** 6 boxes, each flex-1, height 56px, radius `--radius-md`, white,
`shadow-elev-1`, 22px/800 `tabular-nums`. Focused: `outline-[2.5px] outline-sky
outline-offset-[-1px]`. "Reading SMS automatically…" status line with a live-tinted icon.
Resend countdown with `tabular-nums`.
**Error (05):** all six boxes `outline-crit`, an alert line 13px/800 `text-crit`
("That code didn't match — try again"), shake, auto-clear after 400ms, cursor returns to
box 1, and **resend unlocks immediately**.

Keep all auth logic, validation, autofill and rate-limit handling exactly as-is.

**Verification:** lint, typecheck, test.

---

## Task 12: Setup pages — frames 07–11

Migrate `(onboarding)/role`, `clinic-choice`, `clinic-create/step-{1,2,3}`,
`clinic-join`, `done`.

**Role (07):** `.rolec` cards — margin-top 16px, radius `--radius-2xl` (24px), white,
`shadow-elev-2`, padding 18px, flex gap 14px. Icon `.ric` 48px radius `--radius-md` tinted.
Title 16.5px/800; body 12.5px `text-pine-2`. Selected: `outline-[2.5px] outline-pine
outline-offset-[-1px]`. Sticky `.cta`.

**clinic-choice:** no frame — redesign in the same `.rolec` language. **Keep the screen.**

**clinic-create steps 1–3:** frame 08's language on each of the three existing steps.
`.ob-dots` progress; a verified-identity `<Chip tone="live">` with a shield icon;
`Input size="hero"` + mic; `.cta` labelled with the next step ("Next · City");
and the defaults card at the bottom (eyebrow "WE'VE SET THESE — CHANGE ANYTIME IN MORE"
over `<Mini>` chips: 9:30–20:30 · Lunch 13–14 · Sun off · 1 chair).
**The spec collapses this to one screen. We keep all three** (Global Constraint 1) —
restyle each, change no step boundary, no schema, no validation.

**clinic-join (09):** `Input size="hero"` with the code and a live `text-live` check;
clinic preview `Card` with a lime-ring `Avatar` and `<Mini>` chips for city and doctor count;
`.cta` "Request to join". Keep the lookup-before-join behaviour.

**done (11):** Odo celebrating 140px; headline; the join-code `Card` with a key icon,
code, share `<Chip tone="sky">`; `.cta` "Go to Flow". The `qrcode.react` literal colours
are the one documented hex exception.

**Verification:** lint, typecheck, test.

---

## Task 13: Home / Flow — frame 13 (primary state)

`app/(app)/home/page.tsx`. **The highest-traffic screen in the product.** Frame 13.

Order, top to bottom:

1. **Header** — eyebrow `MON · 13 JUL` (12px/700 tracking .12em `text-pine-3`),
   greeting 24px/800 tracking `-.03em`, and on the right a lime 40px `IconCircle` (＋)
   plus the profile `Avatar` (40px, `ring="none"`).
2. **`DayRiver`** — 8 segments + the caption line
   ("3 seen · **Anand in the chair** · 4 to go · ₹7,950 in"). Tapping goes to Schedule.
3. **Hero `.hero-c`** — margin `11px 16px 0`, `bg-hero-c` gradient, radius `--radius-2xl`,
   padding 15px 16px, `shadow-elev-3` + `--highlight-top`.
   Contains: a 56px `ProgressRing` (2/3), the patient name 19px/800 with a chevron,
   a 11.5px/650 `text-pine-2` line carrying procedure + **the allergy in `text-crit`
   font-heavy**, and an inline 46px `.cta` "Continue consultation".
4. **`QuickTile` grid** — 2 columns, gap 9px: Lab (warn icon, red count badge when
   overdue) · Schedule (lav icon) · then the **wide** Block time · Day off bar.
5. **"Up next"** — `SectionHeader` + a horizontal `.hscroll` of `.qcard`s
   (min-width 130px, white, radius 22px, padding 11px, `shadow-elev-1`):
   avatar + name 13px/800 + `<Mini>` chips.
6. **"Needs you"** — `SectionHeader` (action "View all · 3") + `ListRow`s in a `Card`.

**Every existing feature stays.** `VoiceCommandHero` and `VoiceSearchInput` are not in
frame 13 — **do not delete them.** Keep both, placed coherently (the voice hero can sit
under the quick tiles). The `FabMenu` becomes the orb's speed dial (Task 7) — verify it
still opens.

Data: `useNeedsYou`, `useRecentVisits`, `useSchedule`, `useQueueSnapshot`, `useQueueStore`,
`consultHeroSubtitle`. **No query changes.**

The mascot is now permitted here (design-system §12.1) but frame 13 does not show one —
do not add one to this state.

**Verification:** lint, typecheck, test. This page's screenshot diff will be the largest
in the migration; expect and welcome that, but every control listed above must be present.

---

## Task 14: Home / Flow states — frames 14–18

The four remaining Flow states, all driven by **real data**, never a mock toggle.

- **14 — chair free:** `<Chip>` "CHAIR 1 · FREE · GAP 25 MIN"; an 84px sky `ProgressRing`
  (3/8, caption TODAY); next patient's name at 22px/800; `<Mini>` chips;
  `.cta` "Call next patient"; a caption line ("3 done · 5 to go · lunch at 13:00");
  then **"Good gap for"** promoted above the carousel with actionable rows.
- **15 — quiet morning:** Odo 64px in a white `.hero-c`, "Quiet until 11:00",
  a supporting line, `.cta` "Prepare Lakshmi's chart". Same bento below — the skeleton
  never moves, only its copy changes. That is the point of the frame.
- **16 — day done:** `Card` with `wash`, Odo celebrating 96px, "That's all 8",
  "Every record confirmed · nothing pending", three `StatPill`s (seen / today / lab sent),
  then a "Tomorrow" section with the first slot.
- **17 — offline:** the concerned-Odo banner (`bg-[#FDF3E6]`, 30px Odo, warn title,
  a supporting line, a Retry `<Chip tone="warn">`), the normal hero below it with a
  "Sync pending · 2" `<Mini>`, and a footnote that recording, notes and checkout all work
  offline. **Extract `OfflineBanner` out of `components/queue/realtime-dot.tsx`** into its
  own component (this is the third REPLACE in the component mapping).
- **18 — speed dial open:** wire `SpeedDial` (Task 7) to the header ＋ and the orb.
  Items: New patient · Walk-in to queue · New appointment · Quick prescription · New lab case.

State selection must derive from queue, schedule and network state. Put the selection
logic in `lib/queue/home-state.ts` (or extend `home-summary.ts`) **with unit tests** for
every state boundary.

**Verification:** lint, typecheck, test.

---

## Task 15: Consult queue — frames 21, 22

`app/(app)/consult/page.tsx`.

**21 — live queue:** title 28px/800 + a `<Chip tone="live">` with a `StatusDot` ("Live").
`SectionHeader` "Now treating / Chair 1" over a `Card` with `wash`:
a 52px `ring="live"` avatar, name 18px/800, `<Mini>` chips (tooth · sitting, and
`<Mini tone="crit">Allergy</Mini>`), then a 48px `.cta` "Record" beside a 48px
`IconCircle` (undo).
`SectionHeader` "Waiting · 3" over `ListRow`s: 44px `ring="sky"` avatar, name, `<Mini>`
chips, and a lime `<Chip>` "Call in".
`SectionHeader` "Sent to checkout · 2" over dimmed rows with a `<Mini tone="live">` amount.
The orb carries its `active` ring on this tab.
Swipe-right on a waiting row = Call in (add if the gesture already exists elsewhere;
otherwise the button is sufficient — note the deviation).

**22 — empty:** sleeping Odo 110px, "No one waiting", the next booked line, and **two**
exits: a lime `<Chip>` "＋ Add walk-in" and a neutral `<Chip>` "Open schedule".
The header chip reads "Quiet" instead of "Live".

Keep `useQueueStore`, the selectors, `QueueActionSheet`, and every existing action.

**Verification:** lint, typecheck, test.

---

## Task 16: Recording and processing — frames 23–26

`app/(app)/consult/[id]/page.tsx`, `components/voice/recorder.tsx`,
`components/voice/progress-strip.tsx`.

**23 — recording:** nav hidden; header row with a 38px `ring="live"` avatar, name 15px/800,
`<Mini>` chips, and a `<Chip tone="live">REC</Chip>`.
Centre: timer **56px/800 tracking `-.03em` `tabular-nums`**; three concentric breathing
lime rings (inset 0 / 21px / 42px, `border-[1.5px] border-lime` at .25/.5/.85 opacity);
a 92px lime mic circle with `shadow-[0_14px_34px_var(--lime-glow)]`.
Live complaint `<Chip>` below.
Controls: a 62px `IconCircle` Pause and a **76px pine `IconCircle` Finish** with a lime
icon — the only pine-dark element on the screen. Footer "Next · Lakshmi N. · 11:00".

**24 — paused:** rings freeze to `border-hair-2`, timer goes `text-pine-2`, the orb shows ⏸,
a warn banner explains the auto-pause ("Paused automatically for a phone call · audio safe
on this phone"), and **Resume becomes the big lime target** while Finish shrinks.

**25 — processing:** **REPLACE `ProgressStrip`.** Frame 25 deletes the 3-step strip in so
many words: _"Stage chips deleted — three visible steps made 15 seconds feel like three
waits."_ Replace with: Odo thinking 132px, "Processing" 21px/800, a single looping
`.pbar` (216×6px, radius 3, `bg-[rgba(31,42,35,0.08)]`, a 44%-wide lime fill with
`shadow-[0_0_12px_var(--lime-glow)]` animating left→right on `transform` only), and the
honest expectation line "Usually under 20 seconds". A Cancel text action at the bottom.
**Rewrite `test/regression/progress-strip-copy.test.ts`** for the new copy — but keep its
"never shows provider brand names" assertion, which is still law.

**26 — failed:** Odo concerned 120px, "Couldn't process", "The network dropped. Your
recording is safe on this phone.", a 230px `.cta` "Try again", and a text action
"Keep audio · review later".

`useConsultStore` and the SSE stream are untouched. Auto-pause-on-call must still work.

**Verification:** lint, typecheck, test.

---

## Task 17: VerificationCard — pure logic split (ZERO pixel change)

**This is a refactor task. It must change no pixels.** Governance §4.

`components/voice/verification-card.tsx` is 545 lines carrying UI and orchestration, and
five regression tests depend on it. Split it before Task 18 restyles it, so that when
something breaks, `git bisect` lands on either "moved code" or "changed pixels" — never
an ambiguous mix.

Split into `components/voice/verification/`:
`identity-header.tsx` · `summary-bento.tsx` · `medicine-list.tsx` · `record-prose.tsx` ·
`safety-banner.tsx` · `actions.tsx`, with `verification-card.tsx` composing them.

Editing logic already lives in `lib/consult/editors.ts` and `lib/consult/safety-view.ts` —
**keep it there.** Move no logic into components; move any that has leaked into the
component out to `lib/consult/`.

**Constraints:**

- Identical rendered output. Same DOM, same classes, same order.
- All five regression tests pass **untouched**: `verification-card-autosave-draft`,
  `verification-card-identity-from-patient-only`, `verification-card-inline-mode`,
  `verification-card-preview-step`, `overview-tab-invalidates-after-confirm`.
- No prop renames on the public `VerificationCard`.

Commit message must be tagged `refactor(no-visual-change)`.

**Verification:** lint, typecheck, test. The controller will confirm a **zero-pixel diff**
on the verification screenshots — that is this task's real proof of correctness.

---

## Task 18: Verification and saved — frames 27–31

Now restyle the components Task 17 created.

**Header:** "Review" 25px/800; below it the patient name 12.5px/800 (tappable → record),
a chevron, and the procedure 12.5px/700 `text-pine-2`. A 40px `IconCircle` (pen) at right
for free edit.

**Summary bento** (`BentoTile`, 2 cols, gap 9px):
TOOTH (lime tone, tooth icon + 31px/800 number) · FEES (₹ 27px/800 `tabular-nums`) ·
NEXT SITTING (sky tone, `span={2}`, 16px/800 `text-sky`, chevron → that appointment).

**Medicines** — `SectionHeader` "Medicines · N" with the state on the right
(`text-crit` "1 conflict" / `text-live` "✓ checked") over `MedicineRow`s.
**Frame 29 is a hard requirement: 7 medicines must render with the same anatomy as 2** —
one row each, dose chip right-aligned, no squeezing.
Conflict resolution happens **in place** (frame 28): the rail slides out over
`--duration-state`, the row re-renders as the swapped drug with a one-line
`text-live` fact and an Undo, and Confirm goes lime in the same frame. No celebration banner.

**Record prose** — `PaperBlock` with FINDINGS / PROCEDURE / INSTRUCTIONS sections.
Uncertain values render as `VerifyChip`; tapping one puts the cursor on the number.

**Clean state (30):** no red anywhere; a slim `BentoTile tone="live" span={2}` strip
reading "All checks passed — no allergy or drug conflicts"; Confirm lime from the start.

**Sticky CTA:** `.cta` "Confirm & save", **disabled while any conflict rail is unresolved**,
with "Re-record" as a text action beneath.

**31 — saved:** Odo celebrating 128px, "Saved to Anand's record", three outcome `<Mini>`
chips (Rx PDF ready · ₹3,000 → checkout · Thu 16 booked), a 280px `.cta`
"Call next · Lakshmi N.", and a "Back to Flow" text action. Auto-advance after
`--duration-beat` (1.2s).

**Mascot is banned on the verification screen itself** (Global Constraint 12) — frame 31
is a separate success screen, where it is allowed.

All five regression tests must still pass.

**Verification:** lint, typecheck, test.

---

## Task 19: Patients list and search — frames 32–34

`app/(app)/patients/page.tsx`.

**32:** title 28px/800; a 44px `IconCircle` (search) and a lime `IconCircle` (＋).
Filter `<Chip>` row: All (pine = selected) · Today · Treating · `<Chip tone="crit">₹ Due</Chip>`.
Rows are `ListRow`s in a `Card`: a 44px `Avatar` whose **ring encodes status**
(`ringForQueueState`), the name 15.5px/700, a `<Mini>` glyph strip (tooth number ·
sitting dots · dues), and a trailing `StatusDot`.
Sitting dots use the `.dots` pattern: 7px dots, `bg-hair-2`; `.f` filled `bg-live`;
`.h` current `bg-lime` with a 3px `--lime-glow` halo.

**33 — search active:** the header **morphs into the field** — `Input size="field"` with a
search icon, a `.mic-a` affordance, and a "Cancel" text action.
Matches highlight the query span with `bg-lime-soft rounded-[4px] px-[2px]`.
Recents render as `<Chip>`s. A helper line explains that search matches name, phone and ID.

**34 — no match:** sleeping Odo 96px, `No one named "…"`, a hint line, and a 280px `.cta`
`＋ Add "…" as new patient` that **pre-fills the intake name with the query**.
Dead ends convert — that is the frame's whole point.

Keep `VoiceSearchInput`, the existing query params, and every filter.

**Verification:** lint, typecheck, test.

---

## Task 20: New patient and voice intake — frames 35, 36

`app/(app)/patients/new/page.tsx`.

**35 — blank:** header with a back `IconCircle`, "New patient · P-0413" 15px/800.
A `Card` with `wash`: a 44px `.mic-a` block, "Say it in one breath" 14px/800, and an
italic example line. **The blank state sells the voice path first.**
Then `.frm-lb` labels (11px/800 tracking .06em `text-pine-3`) over
`Input size="field"`s: NAME, then AGE (narrow) + PHONE side by side.
FLAGS as toggle `<Chip>`s.
Sticky `.cta` "Create patient", **disabled until name + phone**, with the explanatory line
beneath: "Name + phone unlock the button · everything else can wait". Global Constraint 1 —
a disabled CTA always says why.

**36 — voice intake:** an Odo-listening card; then the same fields, each
**`voiced`** (the lime spine) with a `<Mini tone="lime-soft">🎤</Mini>` tag.
The spine fades on first touch — the form _is_ the review step.
AGE + a gender `Segmented`. CHIEF COMPLAINT with a mic. MEDICAL FLAGS as `<Chip>`s
including `<Chip tone="crit">Allergy: Penicillin</Chip>` and a `＋`.
A collapsed "More details" `ListRow` (address, blood group, referred by).

**Keep every existing field**, the RHF+Zod schema, the add-to-queue option and the blood
group field. Three regression tests bind this page:
`intake-shape-matches-form`, `new-patient-adds-to-queue`,
`new-patient-blood-group-optional`, `new-patient-skip-queue-optional`. All must pass.

**Verification:** lint, typecheck, test.

---

## Task 21: Patient detail — pure logic split (ZERO pixel change)

**Refactor task. No pixels change.** Governance §4.

`app/(app)/patients/[id]/page.tsx` is 958 lines with 5 tabs and 6 sheets in one file.
Split before Task 22 restyles it.

Split into `app/(app)/patients/[id]/`:
`overview-tab.tsx` · `cases-tab.tsx` · `teeth-tab.tsx` · `media-tab.tsx` ·
`billing-tab.tsx` · `prescription-sheet.tsx` · `new-visit-sheet.tsx` ·
`plan-sheet.tsx` · `tooth-sheet.tsx` · `delete-dialog.tsx`,
with `page.tsx` composing them. Shared query hooks move to `lib/patients/queries.ts`.

**Constraints:**

- Identical rendered output on all five tabs and all six sheets.
- These regression tests pass **untouched**: `cases-tab-shows-active-section`,
  `tooth-map-highlights-active-plans`, `overview-tab-invalidates-after-confirm`,
  `patient-detail-receptionist-no-record-findings`.
- The **Media tab stays** — it has no frame and must never be dropped (Global Constraint 1).
- No route change, no query-key change.

Commit tagged `refactor(no-visual-change)`.

**Verification:** lint, typecheck, test. Controller confirms a **zero-pixel diff** across
E6–E10.

---

## Task 22: Patient detail tabs — frames 37, 38, 40, 41

Restyle what Task 21 split.

**Identity block (37):** back + ⋯ `IconCircle`s; a centred 72px `ring="lime"` `Avatar`;
name 22px/800; "34 · M · P-0412" 12.5px `text-pine-2`; medical-flag `<Chip>`s
(`warn` for Diabetic, `crit` with an alert icon for Penicillin).
Three stat `Card`s (sittings 2/3 · last visit · balance in `text-crit`).
An action row: a 48px `.cta` "Record findings" + two 48px `IconCircle`s (phone, Rx).
**`Record findings` is doctor-only** — `patient-detail-receptionist-no-record-findings`
must still pass.

**`.ptabs`** — replace the underline tabs with the spec's inset pill group:
margin `14px 16px 0`, radius pill, padding 4px, `bg-[rgba(31,42,35,0.05)]`;
each tab flex-1, height 34px, 13px/600 `text-pine-2`; active = white pill, `text-pine`,
800, `shadow-[0_3px_10px_rgba(31,42,35,0.12)]`.
**Five tabs, not four** — the spec shows four but the app has Media. Keep all five.
Rename "Tooth Map" → **"Teeth"** (confirmed by the project owner) and update
`scripts/screenshot-routes.ts` (the `patientTab("Tooth Map")` selector) in the same commit.

**Overview:** an active-case `Card` with `wash` — a 60px `ProgressRing`, "RCT · Tooth 36",
`<Mini>` chips (next step, booked time), chevron → case detail (Task 23).
A "Teeth" `SectionHeader` with tooth `<Chip>`s.

**Cases (38):** `VerticalJourney` of sittings with a listening-Odo at the live checkpoint;
`btn2` actions (Schedule remaining, PDF); then Lab and Completed sections as `ListRow`s.

**Teeth (40):** the `Odontogram` with the corrected tone map (Task 9), an UPPER/LOWER
eyebrow, a legend row of `<Mini>`s, and — on tap — an **inline status panel below,
no navigation jump**: the selected tooth `<Chip>`, its current treatment, status `<Chip>`s
(RCT/Crown/Caries/Implant/Extract/Missing) and a `.cta` "Save · link to plan".
Per-tooth media folds in under the panel.

**Billing (41):** a `BentoTile` pair (OUTSTANDING crit / PAID ALL TIME), a "Bills"
`SectionHeader`, bill `ListRow`s with amount + `<Mini>` state, then a `.cta`
"Collect ₹3,000" beside a `btn2` "Remind".

**Media:** no frame — restyle in the same language. Keep everything.

**Verification:** lint, typecheck, test.

---

## Task 23: Case detail and visit record — frames 39, 43

**Case detail (39)** — `app/(app)/patients/[id]/plans/[planId]/page.tsx`.
**This is where every "RCT 36" reference in the app must land.**

Header: back `IconCircle`, "RCT · Tooth 36" 15px/800, `<Chip tone="live">Sitting 2/3</Chip>`.
A patient `ListRow` card (avatar, name, `<Mini tone="crit">Penicillin</Mini>`, P-id,
chevron → patient record).
A `BentoTile` pair: FEES (₹5,500 / 8,000 with a 6px lime progress bar) and
NEXT (sky tone, date 19px/800, sub-line).
"Sittings" `SectionHeader` over `ListRow`s — each leads with a `<Mini tone="live">S1 ✓</Mini>`
and **opens its visit record**.
"Linked" `SectionHeader` over rows for the lab case (→ lab detail) and the active Rx
(→ prescription sheet).

**Then perform a link audit:** find every place the app renders a procedure/plan name and
make it navigate here. Report the call sites you wired. Global Constraint 10.

**Visit record sheet (43)** — new, read-only, opened from any visit row.
Grab handle; title "RCT · Sitting 1 of 3" `.sh-title`; sub "28 Jun · Dr. Priya · tooth 36";
a `<Mini tone="live">✓ Confirmed</Mini>`; three `StatPill`s (paid · medicines · audio length);
a `PaperBlock` with FINDINGS and PROCEDURE; two `btn2`s (Amend, Share PDF); and the footnote
"Originals never change — amendments append with author & time".
Amend uses the existing `ConsultationEdit` append-only path — **do not make records editable**.

**Verification:** lint, typecheck, test.

---

## Task 24: Prescription sheet — frames 44, 45

The `PrescriptionSheet` extracted in Task 21.

**44:** sheet with a lime radial wash in the top-right corner.
Title "Prescription" 21px/800; below it the patient name and a
`<Mini tone="crit">Penicillin</Mini>`; a "Templates" `<Chip>` at right.
Each medicine is a `.medcard`: white, radius `--radius-xl` (22px), padding 14px 15px,
`shadow-elev-1`; a 40px lav `IconCircle` (square, Rx icon); the name at **16px/800**;
`<DoseDots>` + duration on one line; and a remove ✕.
A dashed `btn2` "Add medicine — dose & days suggested".
**The dose legend renders once, above the CTA** ("● DOSE · morning — afternoon — night"),
never per row.
One lime `.cta` "Save & share PDF" — the actual job — with "Save as template" demoted to a
text action.

**45 — conflict:** the offending `.medcard` gets `outline-2 outline-crit outline-offset-[-1px]`
and an inline fix row (white, `border-[1.5px] border-crit`, radius 14px): an alert icon,
"Conflicts with penicillin allergy" 12px/750 `text-crit`, a pine `<Chip>` "Swap", and a
"Remove" text action.
**Share stays locked while unresolved**, with the line "Locked while a conflict is
unresolved" beneath. Same guardrail as verification.

Keep `useCreatePrescription`, template apply (with the allergy re-check on every apply),
PDF fetch, and voice dictation.

**Verification:** lint, typecheck, test.

---

## Task 25: Schedule — frames 46–49

`app/(app)/schedule/page.tsx` and `components/schedule/*`.

**46 — doctor day:** title 26px/800 + a `Segmented` (Day / Week / Mo).
`.week` strip: 7 columns, each flex-1, gap 4px, padding 8px 0, radius `--radius-md`;
weekday 10px/800 `text-pine-3` over the date 15px/800 `tabular-nums`;
selected = `bg-lime` + `shadow-[0_5px_14px_var(--lime-glow)]`; off-days muted.
Timeline: hour rules (`border-hair`) with right-aligned 10px/700 `text-pine-3` labels
36px wide; `AppointmentBlock`s positioned by time; `SlotHint`s on free slots;
`LunchBand`; `NowLine`.
**Gaps and lunch stay visible** — the spec is explicit that empty time is information.

**47 — reception multi-doctor:** two columns with per-doctor headers (26px avatar + name),
a **shared now-line across both**, and per-doctor day-off shading (`bg-hatch-off`).
Tapping a free slot pre-fills that doctor and time.

**48 — new appointment sheet:** patient search `Input` with a live `text-live` check;
a doctor `Segmented`; **free-slot `<Chip>`s from real availability** (never an invalid time);
a procedure field; and a `.cta` labelled with the resolved slot ("Book · Tue 11:45").
A `.mic-a` in the header dictates the whole thing.

**49 — drag to reschedule:** long-press lifts the block (`shadow-drag`,
`rotate(-1.4deg) scale(1.02)`), free slots glow dashed lime, blocked time is hatched and
**rejects the drop**, the origin shows a dashed "was 11:00" ghost, and release raises a
confirm bar ("Move Lakshmi to 11:45?" / Cancel / lime "Move · notify").
Animate `transform` only (Global Constraint 13).
If drag-and-drop does not already exist, implement it with pointer events and a keyboard
alternative (select block → move → confirm); do not ship a mouse-only interaction.

Keep every schedule query, the conflict guard, recurring series, cancel and no-show.

**Verification:** lint, typecheck, test.

---

## Task 26: Reception Today and checkout — frames 50–53

`app/(app)/today/page.tsx` and the queue sheets.

**50:** eyebrow `MON · 13 JUL · ● LIVE` with the live dot; title "Today".
A **money `BentoTile` pair** (COLLECTED / PENDING crit) replacing the current 4-tile grid —
map `collectionStatTiles` onto the pair plus a `StatPill` row; **drop no number**.
"Clinic now" `SectionHeader` over a `Card` grouped **per doctor and chair**, with an
eyebrow row per doctor ("DR. PRIYA · CHAIR 1"), the in-chair patient as a `ListRow` with a
`<Chip tone="live">Rec</Chip>` do-not-disturb marker, waiting patients below, and a
free-chair eyebrow where applicable.
"Checkout" `SectionHeader` over rows with a lime `<Chip>` amount action.

**51 — walk-in sheet:** search-first (most walk-ins are returning), an inline
"＋ New person" row, a doctor `Segmented` (First free / per doctor), `.cta` "Add to queue".

**52 — checkout sheet:** `KeyValue` line items; a hairline rule; **Payable as the biggest
number on the screen (30px/800 `tabular-nums`)**; a payment-method `Segmented`
(Cash / UPI / Card / Bank); `.cta` "Confirm payment · ₹800"; and the reassurance line
"Switching to a UPI app? Odovox waits and returns here."
A discount row appears only for permitted roles.
`take-payment-sheet-shows-items-and-total` must pass.

**53 — payment toast:** success is a **toast, not a page** — a 42px live `IconCircle`,
"₹800 received · UPI", "Receipt sent on WhatsApp", and an **Undo `<Chip>` live for 6s**
(`--duration-undo`). The day's numbers tick up behind it over `--count-up`.

Keep the activity feed, `QueueActionSheet`, `AddToQueueSheet`, realtime, and the offline banner.

**Verification:** lint, typecheck, test.

---

## Task 27: Billing and outstanding — frames 54, 55

**54 — billing** (`app/(app)/billing/page.tsx`): the spec collapses three cards into one.
A hero `Card` with `bg-tile-lime`: eyebrow "COLLECTED TODAY", the figure 33px/800
tracking `-.03em` `tabular-nums`, a `<Mini>` "18 payments"; an **hourly `Bars` strip**
(44px tall, white bars, the peak `hot`) with hour labels; then **cash and UPI·card as two
inline `StatPill`s**.
"By doctor" `SectionHeader` over `ListRow`s (36px avatar, name 16px, amount 15px/800).
"Latest" `SectionHeader` (action "All 18") over a live payment feed — `.payrow`:
flex, gap 11px, padding 9px 16px, `border-t border-hair`; name 13.5px/800 + time
11px/700 `text-pine-3`; a method `<Mini>`; and the amount in `text-live` for payments,
**`text-crit` with a minus for refunds**.
A dues banner `Card` (`bg-crit-soft`) at the bottom: "DUES" eyebrow, "₹3,800 · 3 patients"
18px/800 `text-crit`, chevron → outstanding.

**55 — outstanding** (`billing/outstanding/page.tsx`): a crit `BentoTile span={2}`
(TOTAL OUTSTANDING, 30px, plus `<Mini>` chips for patient count and oldest age);
then patient `ListRow`s with the amount in `text-crit` and a
`<Mini tone="live">` Remind action per row.
**Remind is consent-gated** — keep the existing gate; a patient without consent shows the
action greyed with a lock, and tapping explains why.

**Verification:** lint, typecheck, test.

---

## Task 28: Lab — frames 56–61

**56 — list** (`app/(app)/lab/page.tsx`): back + "Lab" + a "Vendors" `<Chip>` and a lime
`IconCircle` ＋.
**Three `StatPill`s, not tiles** (ACTIVE / OVERDUE crit / READY live) — Global Constraint 9;
frame 56 is where the spec states that law.
Filter `<Chip>`s (All / Sent / Production / Ready).
`ListRow`s: patient name + the LB id in 11.5px `text-pine-3`, a `<Mini>` glyph strip
(tooth · type · vendor), and a right-aligned state `<Mini>` over an 11px/700 stage line.

**57 — the ＋ dial:** Lab is the one list screen with several creations, so its ＋ opens a
`SpeedDial`: **New case (the lime pill — the 90% action)** · Message a lab · Add vendor.
Every other list keeps a direct ＋.

**58 — case detail** (`lab/[caseId]/page.tsx`): title 21px/800 + `<Mini>` chips
(patient, vendor, `<Mini tone="crit">2 days late</Mini>`).
A `Card` with a 6-step `JourneyRail` (Sent · Confirm · Prod · Ready · Recvd · Fitted),
a 46px `.cta` "Mark ready", and two text actions (Message lab · **Raise issue in `text-crit`**).
A `BentoTile` pair (MATERIAL · SHADE, and MARGIN in live tone with the cost→charge line).
A "Photos" `SectionHeader` (action "＋ Add") over a 72px thumbnail strip with a camera tile.
A "History" `SectionHeader` with an Undo `<Mini>` over `KeyValue` rows.

**59 — new case** (`lab/new/page.tsx`): the spec makes this a sheet; **we keep the page**
(Global Constraint 1) and adopt the sheet's field language — `.frm-lb` labels over
`<Chip>` rows for TYPE & TOOTH, VENDOR (recent first), and DUE; a `StatPill` pair for
LAB COST and CHARGE; `.cta` "Create case · LB-114". A mic dictates the whole case.

**60 — consent gate:** a sheet showing **exactly what will leave the clinic** (the message
preview in a `Card`), a `SettingRow` with a `Toggle` recording consent, `.cta` "Send case
card", and the footnote about per-contact consent. **CTA locks when the toggle is off.**
DPDP behaviour must not change.

**61 — vendors** (`lab/vendors/page.tsx`): `ListRow`s with a 44px square avatar and
`<Mini>` chips (WhatsApp ✓ / consent pending warn / automation paused crit, on-time %,
turnaround). A 90-day performance `BentoTile` 2×2.
**Keep the phone masking + Reveal and the automation kill switch.**

Also restyle `lab/[caseId]/edit/page.tsx` (no frame) in the same language.

**Verification:** lint, typecheck, test.

---

## Task 29: Messages, lab inbox, and inventory — frames 62–65, 67–69

**62 — patient inbox** (`app/(app)/messages/page.tsx`): filter `<Chip>`s
(All / Open / Reschedule / Complaint); `ListRow`s with a 46px avatar, name, a truncated
preview 12.5px `text-pine-2`, and on the right the time plus **a category dot and an
unread lime dot** — no label spam. A "Lab inbox" entry row with a
`<Mini tone="warn">2 need action</Mini>`.

**63 — thread** (`messages/[conversationId]/page.tsx`): `.bub` bubbles — max-width 76%,
radius 18px, padding 9px 13px, 13.5px/500; inbound white with
`rounded-bl-[6px]` + `shadow-elev-1`; outbound `bg-lime-soft` with `rounded-br-[6px]`.
Timestamps 10px `text-pine-3` with read receipts.
A header with the category `<Mini>` and a **window-countdown** `<Mini tone="live">`.
When a time is agreed, a lime `<Chip>` "Book Thu 18:15 →" appears centred — one tap into
the appointment sheet.

**64 — window closed:** the composer **swaps itself** for a template rail:
a `Card` explaining the rule in one line ("Free text is locked by WhatsApp's 24-hour rule"

- "Send an approved template — typing unlocks when she replies") over template `<Chip>`s.
  Never a mystery send-failure.

**65 — lab inbox** (`messages/lab/page.tsx`): three quiet verdict `Card`s —
**✓ Applied** (with an Undo `<Mini>`), **Suggested** (a pine `<Chip>` one-tap apply +
Reply), and **Link** (unknown sender → Link to case + Reply).
**Zero "AI" labels anywhere** — strip any that exist.

**67 — inventory** (`app/(app)/inventory/page.tsx`): three mic `<Chip>`s
(Purchase / Usage / Count — Count stays admin-gated); a "Low stock · 2" `SectionHeader`
in `text-warn` over rows with a `<Mini tone="warn">8 left</Mini>`; then "All items · 64"
over rows with right-aligned counts.

**68 — item detail** (`inventory/[itemId]/page.tsx`): a `BentoTile` pair (IN STOCK in warn
tone with the reorder threshold; ₹/STRIP · VENDOR with the expiry); an action row
(`.cta` ＋ Purchase, `btn2` − Consume, `btn2` ⟲ Adjust — **admin-only, reason required**);
and a "Movements" `SectionHeader` over `KeyValue` rows with **signed, coloured deltas**
(`text-crit` for out, `text-live` for in).

**69 — voice confirm sheet:** "Heard you" + the transcript in italic `text-pine-2`, then
`KeyValue` rows of the parsed fields with a `<Mini tone="live">matched</Mini>`, a
`.cta` "Confirm +10 strips", and "Tap any line to fix it".
**Voice never writes stock silently: parse → show → confirm.** This is the contract every
v10 voice write inherits.

Also restyle `inventory/new` and `inventory/categories` (no frames) in the same language.

**Verification:** lint, typecheck, test.

---

## Task 30: Management pages, Account, and Switch role — frames 72–77

**Management pages** — restyle `clinic/whatsapp` (72: a Connected card, automatic-message
`SettingRow`s with `Toggle`s, a monthly-spend `Card` with a budget bar and a 6-month `Bars`
strip), `clinic/availability` (73: a doctor `Segmented`, per-day `SettingRow`s with lime
time-range `<Mini>`s and a ＋, and "Copy Monday to weekdays"), `clinic/day-off`
(74: a scope `Segmented`, date + reason fields, `.cta`, upcoming rows with tinted icons and
a remove ✕, and the warn card about existing bookings), `clinic/templates`
(75: search + template `ListRow`s), and `clinic` itself as a `SettingRow` list.

**Account page (76)** — **new route** `app/(app)/account/page.tsx`. The app currently has
only a `ProfileButton` dropdown with logout; the spec has a full page:
a profile `Card` (54px lime-ring avatar, name 17px/800, phone · clinic, an Edit `<Chip>`);
a `SettingRow` list — Switch role · Clinic details · Professional details (🔒 Encrypted) ·
Language (English / மொழி) · Notifications `Toggle`;
a second list — Privacy & data with the DPDP line;
a third — Sign out in `text-crit`;
and the version footer "Odovox 1.0 · Made in Chennai".
**Keep the existing dropdown logout working** — add the page, remove nothing.
Professional details need `PATCH /clinics/members/me` (the encrypted fields already exist
on `ClinicMember`); add it if absent.

**Switch role (77)** — a confirm sheet stating exactly what changes: a `KeyValue` list
(HOME: Flow → Today · ORB: Mic → ＋ · KEEPS: Patients, Schedule, Messages), `.cta`
"Switch role", Cancel. Needs `GET /clinics/memberships` + `POST /auth/switch-membership`.

**Verification:** lint, typecheck, test. Write API tests for the two endpoints you add.
Do **not** run the full API suite (Global Constraint 23).

---

## Task 31: Team & join code, and Notifications — frames 71, 80

The backend-heaviest task in the plan. Both surfaces exist in the schema already; neither
has any endpoint.

**Team & join code (71)** — new route `app/(app)/clinic/team/page.tsx`:
a `Card` with `wash` showing the join code 26px/800 tracking .08em with rotate and share
`<Chip>`s; a "Requests" `SectionHeader` in `text-sky` over rows with lime Approve and a
crit ✕; a "Members" `SectionHeader` over rows with role `<Mini>`s and a ⋯ menu
(change role / remove — admin only, confirm).
Needs `GET /clinics/members`, approve, reject, `PATCH` role, and join-code rotate.

**Notifications (80)** — new route `app/(app)/notifications/page.tsx`.
The `Notification` **model already exists in `schema.prisma` with zero usage** — no
migration needed. Add `GET /notifications`, `POST /notifications/:id/read`,
`POST /notifications/read-all`, and write sites at:
`lib/billing/payment-service.ts` (after `tx.payment.create`),
`lib/lab/transition-service.ts` (after `tx.labCase.update`),
`lib/whatsapp/webhook-service.ts` (after the inbound conversation upsert).
All three are already inside transactions — make the write idempotent on
`(userId, type, payload.entityId)`.
Rows have **two tap zones**: the bold name opens the patient, the row body opens the object.
Unread = a lime `StatusDot`.

`ClinicMember.status` already defaults to `PENDING` and `Clinic.joinCode` already exists —
**no schema migration is needed for either surface.**

**Verification:** lint, typecheck, test. Write API tests for every endpoint you add.
Do **not** run the full API suite (Global Constraint 23).

---

## Task 32: v10 Talk to Odo — frames v10-01 … v10-05

The second spec, end to end. A sheet opened by the orb hold (Task 5), built from the
Task 10 atoms.

**The parse-confirm contract from v9-69 is law here:** voice never writes silently —
parse, show, confirm. Every state below inherits it.

- **01 listening:** a listening-Odo with a pulsing ring, "Listening…", a live `Wave`,
  a ✕, the live `Transcript` with entity lifts, the bilingual hint
  ("தமிழ் + English — both fine"), and a pine "Done ✓" `<Chip>`.
  Ends on a 1.2s pause (`--speech-pause`), Done, or "seri". ✕ cancels — **nothing written**.
- **02 parsed:** an `IntentChip`, a "Re-say" action, the heard text, `ParsedField` rows,
  **one** `OdoBubble` follow-up asking only for a missing-critical field, a `.cta`
  "Create <name>", and a skip action. Tapping a field edits it inline.
- **03 done:** a celebrating Odo, "<name> added", `<Mini>` chips (id · ✓ saved · Undo),
  next-act `SayChip`s, an `OdoBubble` ("Still listening…"), a small `Wave`, and
  "Done for now". **The mic stays warm for chained commands.**
- **04 correction:** the low-confidence token carries the dotted warn underline; an
  `OdoBubble` asks which; three `SayChip`s (each candidate + "Spell it"); re-say or tap to
  type; **Create stays locked only while a flagged field is unresolved** and everything
  already parsed survives the fix.
- **05 grammar:** "Say it like you'd say it" over `CmdRow`s for the seven intents, each
  tappable to start listening pre-biased to that intent, and the footnote that
  consultation recording stays on the orb's tap — protected from misfires.

**Reuse the ten existing `/dictate/*` endpoints** — they already return structured fields.
Classify intent client-side; **add no new dictation endpoint.**

Put the intent classifier and the chained-command queue in `lib/voice/` **with unit tests**
covering: Tamil–English code-switched input, an unrecognised intent (must fall back to
patient search, never a dead end), a missing-critical field, and two commands in one breath.

Finally, verify the three toast voices from Task 4 are wired everywhere a reversible action
occurs (frame 79).

**Verification:** lint, typecheck, test. This task adds API endpoints — write API tests for
each new endpoint. Do **not** run the full API suite (Global Constraint 23); run only your
new test files.

---

## Out of scope

These are recorded so no task silently absorbs them:

- **Frame 06 (device unlock)** — descoped pre-launch by the project owner. WebAuthn is not
  being built; a PIN gate may follow later.
- **Frame 12 (first-day checklist)**, **frame 20 (week in review)**, **frame 42 (history
  timeline page)**, **frame 66 (follow-ups)** — these need either new aggregate endpoints or
  the `FollowUpResolution` table. They are scoped in
  `docs/migration/03-visual-migration-plan.md` §4.2 and follow this plan.
- The API test suite re-baseline (~69 min) is the controller's job, not a task's.
