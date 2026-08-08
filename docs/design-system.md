# Odovox Design System

> Every UI work — every screen, every component, every retrofit — reads this
> document first. No exceptions. Last updated: 2026-08-08 (Phase 10). If something here conflicts with a phase prompt,
> raise the conflict; don't deviate silently.
>
> **Locked at Phase 2.5.** Source of truth for tokens is
> [`packages/ui/src/tokens.css`](../packages/ui/src/tokens.css); primitives live in
> [`apps/web/components/ds/`](../apps/web/components/ds); their pure logic (tested) lives in
> [`apps/web/lib/ds/`](../apps/web/lib/ds).
>
> ### ⚠ Phase 10 — migration in progress
>
> The app is migrating to the **v9/v10 design language** (`odovox-v9-master.html`,
> `odovox-v10-talk.html`). That is a different design system, not a recolor: pine ink,
> alpha-over-pine hairlines, saturated/soft semantic pairs, and a white top highlight on
> every raised surface.
>
> **§12.1 below is rewritten and authoritative.** Sections 1–11 still describe the
> Phase 2.5 system and are being superseded stage by stage; where they conflict with
> `tokens.css` or the migration docs, the migration docs win:
>
> - [Feature matrix](migration/01-feature-matrix.md) — 232 features → frame, status, risk
> - [Component mapping](migration/02-component-mapping.md) — 76 components → reuse/modify/replace/new
> - [Visual migration plan](migration/03-visual-migration-plan.md) — per-page plan + Stage 0
> - [Migration governance](migration/04-migration-governance.md) — QA checklist, perf budgets, done-criteria
>
> During the migration both token sets are live: the v9 canonical names (`pine`, `sky`,
> `live`, `warn`, `lav`, `crit`, `hair`) and the legacy pastels. A legacy token is
> deleted only when its call count reaches zero.

---

## 1. Color tokens

All colors are CSS variables in `tokens.css` and exposed as Tailwind utilities via
`packages/ui/src/tailwind-preset.ts`. **No hex literals anywhere except `tokens.css`.**

| Token                                 | Value                 | Tailwind              | Use                                              |
| ------------------------------------- | --------------------- | --------------------- | ------------------------------------------------ |
| `--color-ink`                         | `#0a0a0a`             | `bg-ink` `text-ink`   | primary text, hero-card backgrounds              |
| `--color-ink-soft`                    | `#1a1a1a`             | `bg-ink-soft`         | secondary dark surfaces                          |
| `--color-paper`                       | `#fafaf7`             | `bg-paper`            | app background (warm off-white)                  |
| `--color-paper-warm`                  | `#f4f3ee`             | `bg-paper-warm`       | raised neutral panels, sheet bg                  |
| `--color-paper-cream`                 | `#f9f6f0`             | `bg-paper-cream`      | **mascot/celebration backgrounds only**          |
| `--color-lime` / `-soft`              | `#d4f564` / `#e8f8b5` | `bg-lime` `text-lime` | **primary action / voice / "your turn"**         |
| `--color-sage`                        | `#7ba098`             | `bg-sage` `text-sage` | **clinical context** (plans, procedures, status) |
| `--color-sage-soft`                   | `#c9dcd6`             | `bg-sage-soft`        | clinical chips, success surfaces                 |
| `--color-sage-tint`                   | `#e6efec`             | `bg-sage-tint`        | faint clinical backing                           |
| `--color-sage-deep`                   | `#4a6b62`             | `bg-sage-deep`        | clinical emphasis text                           |
| `--color-peach` / `-soft`             | `#ffd4a3` / `#ffe8d1` | `bg-peach`            | category: patients, warmth, billing              |
| `--color-sky` / `-soft`               | `#bfe3ff` / `#dff1ff` | `bg-sky`              | category: schedule, time                         |
| `--color-lavender` / `-soft`          | `#e0d4ff` / `#efe9ff` | `bg-lavender`         | category: lab, special                           |
| `--color-success/warning/danger/info` | —                     | `text-success` …      | **system messages only, never decorative**       |

**Glass colors** (rgba): `--glass-bg-light/dark/lime/sage`, `--glass-border-light/dark`
→ `bg-glass-light`, `bg-glass-dark`, `border-[var(--glass-border-light)]`.

### Color usage rules (the law)

- **Lime** = primary action, voice, "your turn" (CTA buttons, mic, Start Consultation, active tab pill).
- **Sage** = clinical context (treatment plans, procedure/clinical status, success states). Phase 2.5 deepened sage from a pale mint (`#c8e6c9`) to a muted clinical `#7ba098`.
- **Ink** = primary text + hero-card backgrounds.
- **Peach / Sky / Sage-tint / Lavender** = category coding (Quick Tools, status, specialty chips).
- **Paper-cream** = mascot / celebration backgrounds only.
- **Glass-light** = hero/glass cards on light backgrounds; **Glass-dark** = over photos/gradients.
- **Danger / Warning / Info / Success** = system messages only — never decorative.

---

## 2. Surfaces & elevation

Elevation tokens: `--elev-0 … --elev-4`, `--elev-hero`, `--elev-lime-glow`, `--elev-sage-glow`
→ `shadow-elev-0..4`, `shadow-elev-hero`, `shadow-lime-glow`, `shadow-sage-glow`.

| Surface                   | Treatment                                | Elevation                                    |
| ------------------------- | ---------------------------------------- | -------------------------------------------- |
| Page background           | `bg-paper` + optional `<GradientMesh>`   | —                                            |
| List card / row           | solid `bg-surface` border                | `shadow-elev-1` (hover/active `-2`)          |
| Quick-tool tile           | pastel accent                            | `shadow-elev-2`                              |
| Hero card (dark/light)    | `<HeroCard>`                             | `shadow-elev-2/3` or `shadow-lime/sage-glow` |
| Glass card / sheet header | `<GlassCard>` (`backdrop-blur-glass-md`) | `shadow-elev-2`                              |
| FAB                       | lime pill                                | `shadow-lime-glow`                           |
| Modal / hero moment       | glass or `bg-ink`                        | `shadow-elev-hero`                           |

**No new flat surfaces.** Every elevated surface (hero, card, modal, FAB) carries depth:
shadow, glass, gradient, or border layering. Plain lists and forms may be solid.

**Glass budget: ≤ 4 glass surfaces per screen** (perf). Glass only on: hero/glass cards,
modal/sheet headers, the dev banner, and the `/done` celebration card.

---

## 3. Typography

- **Geist Sans** (`font-display`) for UI; **Geist Mono** (`font-mono`) for codes/numbers.
- Display sizes: **48 / 32 / 28 / 24 / 20** px. `<EditorialHeading>` titles render at 28.
- Body sizes: **18 / 16 / 14 / 13 / 11** px.
- Numeric data uses `tabular-nums` + the mono face (`<StatTile>`, join codes, money).

---

## 4. Spacing

4px base scale via Tailwind utilities (`gap-3` = 12px, `p-5` = 20px, …). Screen gutters are
`px-5` (lists/dashboards) or `px-7` (onboarding). Sticky CTAs add `var(--safe-bottom)`.

---

## 5. Motion

Tokens: `--ease-spring`, `--ease-spring-soft`, `--ease-out`, `--ease-in`,
`--duration-instant|fast|base|slow|emphatic`. Shared Framer specs live in
[`components/ds/motion.tsx`](../apps/web/components/ds/motion.tsx) — **never hand-roll a transition.**

| Spec                    | When                                   |
| ----------------------- | -------------------------------------- |
| `fadeInUp`              | section/page content entrance          |
| `springScale`           | cards/modals popping in                |
| `slideUpSheet`          | bottom sheets / modal sheets           |
| `staggerChildren(0.04)` | lists, FAB menu items                  |
| `floatLoop`             | mascot / hero-object idle float (±4px) |
| `gentlePulse`           | "alive but idle" elements              |

Use `ease-spring` for playful pops (FAB, mascot bounce), `ease-spring-soft`/`ease-out` for content,
`ease-in` for exits. Page transitions ~`--duration-slow`, micro-interactions ~`--duration-fast`.

---

## 6. Components — when to use what

All exported from `@/components/ds`. Pure logic in `@/lib/ds/*` is unit-tested.

### `<HeroCard>` — elevated hero pattern

```tsx
<HeroCard variant="dark|light|glass-dark|glass-light" size="compact|md|lg"
  icon={<Stethoscope/>} title="…" subtitle="…" trailing={<ArrowRight/>}
  glow="none|lime|sage" onClick={…} />
```

`dark`=`bg-ink`/white; `light`=`bg-paper-warm`; glass variants frost over photos/gradients.
Used on: Start Consultation, Record findings, Speak patient details, role/clinic choices, join confirmation.

### `<GlassCard>` — light glassmorphic surface

```tsx
<GlassCard tone="light|dark|lime|sage" border="soft|none">
  …
</GlassCard>
```

Hero/modal/sheet/dev-banner/`/done` only. Never on lists or repeating items.

### `<EmptyState>` — every empty surface

```tsx
<EmptyState
  mascot="thinking|sleeping|celebrate|smile|none"
  illustration={<IlluCalendarSoon />} // mascot XOR illustration
  icon={<Calendar />}
  iconTone="sky|info|sage|peach|neutral" // for inline / icon-only
  title="…"
  body="…"
  cta={{ label, onClick }}
  variant="page|card|inline"
/>
```

Logic: `resolveEmptyMedia()` (illustration wins if both given). Three shapes:

- **`inline`** — small icon (in an `iconTone` chip) + title + body in a horizontal
  `bg-paper-warm` card. Use for _inside-section_ empties on **working screens** (Home
  Today / Needs You, Live queue, Media / Cases / Billing tabs). Never a mascot here.
- **`card`** — centered, inside an existing section box (mascot allowed for emotional moments).
- **`page`** — full-screen empty tabs (`<IlluCalendarSoon/>` etc. for "coming soon").

Mascot = emotional moments (splash/onboarding/done + dedicated empty cards); illustration =
"coming soon" tabs; `icon` = working-screen inline empties.

### `<StepperHeader>` — multi-step wizard indicator

```tsx
<StepperHeader steps={[{id,label}…]} current="basics" />
```

Logic: `stepperStates()`. Complete=filled lime + check; current=lime outline; upcoming=muted.

### `<FAB>` / `<FabMenu>` — floating actions

```tsx
<FabMenu items={[{id,label,tone,icon,onClick}…]} offset={{bottom:96,right:16}} />
```

Bottom-right on top-level routes, `offset.bottom:96` clears the floating tabs. Closed = lime `+`
pill (`shadow-lime-glow`); open rotates to `×`, dims a backdrop, stagger-emerges white item pills,
closes on item tap / outside tap. Logic: `fabReducer` + `dispatchFabItem` (tested).

### `<EditorialHeading>` — page tops

```tsx
<EditorialHeading
  eyebrow="TUE · 23 JUN"
  title="Hi, Dr. Asha"
  subtitle="…"
  trailing={<Avatar />}
/>
```

### `<StatTile>` — dashboard numbers

```tsx
<StatTile
  value="₹18.4k"
  label="Revenue today"
  variant="default|lime|sage|warning"
  size="sm|md"
/>
```

Mono + `tabular-nums`.

### `<DecorativeFooter>` — sparse-screen filler

```tsx
<DecorativeFooter variant="waveform|tooth-grid|mascot-peek|dots" />
```

Absolute, pointer-events-none, low opacity. `/phone` + `/otp` use waveform/dots.

### `<BottomTabs>` — floating role-based tab bar

Floating paper pill (`bg-paper/95 backdrop-blur-md`, `shadow-elev-2`, `rounded-pill`), 16px from the
screen edges with `var(--safe-bottom)` respected. **5 tabs.**

> Bottom tabs: lime pill ONLY on the active tab, with the label visible next to its icon. Inactive
> tabs are icon-only, muted. This is the locked design — do not show labels on inactive tabs.

- **Active tab:** lime pill (`bg-lime`) behind both the icon and label; label sits _next_ to the icon
  (`text-ink font-medium text-sm`), never below it. The label slides in from the icon's right edge.
- **Inactive tabs:** muted icon only (`text-text-muted`), no label, no background. The label stays in
  the DOM as `sr-only` for screen readers.
- **Press:** tapping an inactive tab scales to 0.95 then springs to the lime pill (`layoutId="tab-pill"`).
- Doctor tabs: `Home · Patients · Schedule · Lab · Clinic`. Receptionist tabs: `Today · Patients ·
Schedule · Lab · Billing`. **[test: bottom-tabs-active-only-label]**

### `<AnnotationCallout>` — pointer-line label (Phase 3+)

```tsx
<AnnotationCallout
  label="Veneers"
  position={{ x: 0.4, y: 0.6 }}
  pointTo={{ x: 0.5, y: 0.7 }}
/>
```

### `<MascotMoment>` / `<DecorativeArt>` — see §7–8.

---

## 7. Mascot rules (Odo)

`<MascotMoment pose size animation background />` — poses `hero|smile|celebrate|thinking|sleeping`,
sizes `sm 80 · md 140 · lg 200 · xl 280`, animations `none|float|bounce-in|gentle-pulse`,
backgrounds `none|cream|glass`. Asset mapping is `mascotAssetVar(pose)` → `var(--illu-mascot-<pose>)`.

**Odo appears on:** splash, onboarding slide 1 (hero) + slide 2 (smile corner), `/role` (thinking),
`/clinic-choice` (hero), `/clinic-join` header (thinking), `/done` (celebrate), and inside
**empty-state cards** (sleeping/smile/thinking) and success moments.

**Odo NEVER appears as chrome on working screens** — no decorative mascot on the Home dashboard
header, patient-detail header, or any list/repeating surface. (Empty-state cards _within_ those
screens are the only exception, because an empty state is an approved moment.)

Generation prompts → §13.

---

## 8. 3D objects & SVG illustrations

**3D object renders** via `<DecorativeArt object="tooth|xray|mirror|pills|clipboard" />`
(`var(--illu-object-*)`). Placeholder PNGs in `apps/web/public/illu/objects/`. Prompts → §13.

**SVG line illustrations** (1.5px ink stroke, lime accent dots, sage/sky/lavender/peach tint backing,
~144px), in [`components/illustrations/line-illustrations.tsx`](../apps/web/components/illustrations/line-illustrations.tsx):

| Component              | Use                                  |
| ---------------------- | ------------------------------------ |
| `<IlluCalendarSoon/>`  | Schedule placeholder tab             |
| `<IlluFlaskSoon/>`     | Lab placeholder tab                  |
| `<IlluBuildingSoon/>`  | Clinic placeholder tab               |
| `<IlluPaymentSoon/>`   | Billing placeholder tab + "no bills" |
| `<IlluInventorySoon/>` | Inventory placeholder                |
| `<IlluHappyTooth/>`    | inline "all clear" empty states      |

---

## 9. Forms & inputs

- React Hook Form + Zod (`zodResolver`) everywhere. The clinic wizard slices `ClinicCreateInput`
  per step (`stepBasicsSchema`/`stepHoursSchema`/`stepProfileSchema` in `lib/ds/wizard.ts`).
- Focus ring: `--ring-lime` (2px lime + 4px lime-soft halo). Inputs add `--inset-input`.
- Inline errors: `text-xs text-danger` under the field via `<FormField error>`.
- Buttons expose `loading` (collapses label to a pulsing mono "…") and disabled states.
- Long forms (>12 fields) become a **wizard** (see clinic-create), never one endless page.

---

## 10. Lists & cards

- Card elevation `shadow-elev-1`; active/hover `shadow-elev-2` (+ optional slight translate).
- Status color coding: lime (active/your-turn), gray (neutral), peach (attention/dues),
  sky (scheduled/lab), sage (clinical/healthy).
- Avatar rings: lime ring (`ring-2 ring-lime/40 ring-offset-2`) on the focused identity (patient detail).
- Never glass on list/repeating items (perf).

---

## 11. Empty states

Every empty surface uses `<EmptyState>`. **Mascot vs illustration:** mascot for emotional moments
(no data yet, all clear, success), illustration for "coming soon" feature tabs. Page-level empties
use `variant="page"` (centered, mascot `lg`); inline card empties use `variant="card"` (mascot `md`).

---

## 12. Forbidden patterns

- ❌ Hex literals in JSX/CSS outside `tokens.css`. _(Exception: `qrcode.react` requires literal
  `bgColor`/`fgColor` strings — documented and isolated to `/done`.)_
- ❌ Inline emoji as the only celebration — use the mascot.
- ❌ Mascot as chrome on Home, Patient detail, or any list/repeating surface (empty-state cards excepted).
- ❌ Glassmorphism on lists or repeating items (perf).
- ❌ Long single-page forms — break into a wizard if > 12 fields.
- ❌ "Coming soon" text-only — always `<EmptyState>` with an illustration.
- ❌ Hand-rolled transitions — import from `ds/motion`.

### §12.1 Forbidden patterns (enforced)

> **Rewritten in Phase 10 (UI migration).** The v9 spec deliberately reverses two rules
> locked in Phase 2.6 — the ambient wash and the mascot ban. The guardrails stay; their
> targets move. Items marked **[test]** have a regression test under
> `apps/web/test/regression/`.

**Still forbidden, unchanged:**

- ❌ Hex literals in JSX/CSS outside `tokens.css`. _(Exception: `qrcode.react` requires literal `bgColor`/`fgColor` — isolated to `/done`.)_
- ❌ Emoji in headings. Mascots and SVGs handle visual emphasis. **[test: heading-no-emoji]**
- ❌ Glassmorphism on lists, repeating items, or forms. The spec uses glass on exactly **two** surfaces: the nav pill and the voice menu. **[perf budget: governance §2]**
- ❌ Hand-rolled transitions — import from `ds/motion`; durations and easings come from tokens.
- ❌ Flat empty states — must use `<EmptyState>`.
- ❌ Hero cards without depth.
- ❌ Long single-page forms — wizard if > 12 fields.
- ❌ Quick-tool tile icons in plain ink — use the tile's saturated colored icon.
- ❌ Any raised surface without its top highlight (`--highlight-top`). This is the token that separates "recolored" from "handcrafted".
- ❌ Animating `box-shadow`, `background`, or gradients. Animate `transform`/`opacity` only. **[governance §2]**
- ❌ Nested backdrop filters, or more than two blurred surfaces on screen. **[governance §2]**

**Reversed by the v9 spec:**

- ✅ **The ambient wash is now allowed app-wide.** v9 puts `--amb` (lime 20% top-left, sky 10% top-right) behind every frame at varying opacity. What stays forbidden is a _hand-rolled_ wash: the layer must come from the token, never an inline gradient.
  _Was: ❌ `<GradientMesh>` on `(app)/_`.\*
- ✅ **The mascot is allowed on working screens.** v9 puts Odo on Home (frames 15/16/17), Consult-empty (22), Processing (25), search-no-match (34), the Cases journey (38) and the history timeline (42).
  **The spec's own law bans Odo only where it undermines trust: verification, the prescription sheet, checkout, and billing — money and safety.** That is the rule now.
  _Was: ❌ mascot anywhere inside `(app)/_`.\*

**New under v9:**

- ❌ **Red (`--crit`) used decoratively.** It has one meaning: _act now_. A 3.5px inset rail on the offending row plus a factual clinical line. Never a pink wash, never a banner, never an "AI voice".
- ❌ **A lone number in a bento tile.** A bare count gets a 46px `.stat` pill. Tiles are for content with structure (money + breakdown, dates, warnings).
- ❌ **Dead ends.** _If it names a thing, it opens that thing. If it shows a number, it opens where the number comes from. If it can't be tapped, it doesn't get a chevron._ (frame 81)
- ❌ **Greys.** Muted text and every hairline are alpha over pine (`--pine-2/-3`, `--hair/-2`), never a neutral grey.

### §12.2 Test migration schedule

Stage 0b changed **tokens only**, so it invalidated none of the existing tests — all 351
still pass. Repointing a test before the behaviour it guards has changed would leave it
asserting nothing, so each moves in the stage that actually changes its subject:

| Test                            | Changes in                                  | Becomes                                                                           |
| ------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| `no-wash-on-app-routes`         | Stage 3 (`AmbientWash` lands)               | asserts the wash comes from the token, and that no route hand-rolls a gradient    |
| `no-mascot-on-home`             | Stage 5 (`/home` migration)                 | renamed `no-mascot-on-money-or-safety`: verification, Rx sheet, checkout, billing |
| `progress-strip-copy`           | Stage 6.3 (frame 25 replaces the component) | asserts the new single-bar copy; keeps the "no provider brand names" clause       |
| `bottom-tabs-active-only-label` | Stage 3 (nav restructure)                   | kept; updated for 4 tabs and the spec's capsule dimensions                        |

---

## 13. Production prompts for AI image gen

Generate Odo with **consistent character design across all 5 poses** — same proportions, finish, and
eye style. Technique: generate `hero` first, then use it as the image/character reference for the rest
(Midjourney `--cref <url>`, or DALL·E iterative "same character as the previous image"). Export 1024×1024,
transparent background. Drop files into `apps/web/public/illu/{mascot,objects}/` keeping the exact names.

**ODO — Hero (onboarding slide 1, splash) → `odo-hero.png`**

> 3D render of a friendly tooth character with soft smile, single tooth shape with subtle crown
> contours, glossy ceramic white finish, kind eyes (not goofy), arms slightly raised in welcome, soft
> studio lighting from upper left, transparent background, premium product visualization style,
> 1024x1024, centered, slight ambient occlusion, no shadows on background.

**ODO — Smile (onboarding slide 2, small success) → `odo-smile.png`**

> Same 3D tooth character, gentle closed-mouth smile, looking slightly off-camera, relaxed pose,
> glossy ceramic finish, soft natural lighting, transparent background, 1024x1024 centered.

**ODO — Celebrate (clinic created / done page) → `odo-celebrate.png`**

> Same 3D tooth character, both arms raised in celebration, eyes closed in joy, small confetti pieces
> around (subtle, not overwhelming), glossy ceramic finish, golden-hour lighting, transparent
> background, 1024x1024.

**ODO — Thinking (empty list states, error fallback) → `odo-thinking.png`**

> Same 3D tooth character, one arm under chin in thinking pose, slight head tilt, curious eyes looking
> up-right, glossy ceramic finish, soft lighting, transparent background, 1024x1024.

**ODO — Sleeping (no-data, off-hours) → `odo-sleeping.png`**

> Same 3D tooth character, eyes peacefully closed, gentle ZZZ thought bubble small to upper right,
> slight head tilt, glossy ceramic finish, soft moonlight lighting, transparent background, 1024x1024.

**Objects** (`illu/objects/`):

- `tooth.png` — Single white ceramic tooth, 3D, glossy, soft studio light from upper left, transparent bg, centered, premium product photography, 1024x1024, no face.
- `xray-film.png` — Dental panoramic x-ray film, blue-black radiograph look, soft glow behind, floating slightly tilted, 3D, transparent bg, 1024x1024.
- `dental-mirror.png` — Stainless steel dental mirror tool, 3D, polished silver, soft reflection, transparent bg, centered, 1024x1024.
- `pill-bottle.png` — Small white pill bottle with a lime-green accent stripe (no text), a few white pills beside it, 3D, transparent bg, soft lighting, 1024x1024.
- `clipboard.png` — Wooden dental clipboard with a clean form attached, slight perspective, 3D, transparent bg, soft lighting, 1024x1024.

---

## 14. Performance budget

- Lighthouse **mobile Performance ≥ 88** on `/phone`, `/home`, `/patients`; **Accessibility ≥ 95**.
- LCP < 2.5s · CLS < 0.05 · INP < 200ms.
- **Glass surfaces capped at 4 per screen.** Glass never on lists/repeating items.
- Mascot/object PNGs are `background-image`d and lazy by nature; SVG illustrations are inline + tiny.

---

## 15. Phase compatibility

This system was **locked at Phase 2.5**. Every future phase consumes from here: tokens from
`tokens.css`, primitives from `components/ds`, illustrations from `components/illustrations`. If a
phase needs a new primitive, **propose it as an addition** (new file + tests + a row in this doc) —
never redefine an existing token or primitive. If a phase prompt conflicts with this document, raise
the conflict before deviating.
