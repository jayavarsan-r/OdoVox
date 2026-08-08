# Document 4 — Migration Governance

> The rules every stage and every commit obeys. Added at your request before Stage 0.
> Where Docs 1–3 say _what_ to migrate, this says _how it is allowed to land_.

---

## 1 · Design QA checklist

Docs 1–3 prove **feature parity**. This proves **visual parity**. Every migrated page
passes all 13 before its commit.

| #   | Check                         | How it is verified                                                                                               |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | **Spacing matches**           | Gutters, card padding and gaps read from tokens, not literals. Measured against the frame at 390px               |
| 2   | **Typography matches**        | Size, weight, tracking and line-height all from the type ladder. No literal `text-[13px]`                        |
| 3   | **Radius matches**            | Every corner from `--radius-*`. No literal radii                                                                 |
| 4   | **Elevation matches**         | Every raised surface carries its spec shadow **and** `--highlight-top`. No surface is flat that shouldn't be     |
| 5   | **Glass matches**             | `--glass` + `--glass-line` + 30px blur + 1.9 saturate. Only where §2 permits                                     |
| 6   | **Motion matches**            | Durations, easings and staggers from tokens. No hand-rolled transitions                                          |
| 7   | **Touch targets match**       | Every interactive element ≥ 44×44 (`--target-min`); orb 66; CTA 52                                               |
| 8   | **Safe areas respected**      | `var(--safe-top)` / `var(--safe-bottom)` on fixed and sticky elements. Nothing under the notch or home indicator |
| 9   | **Contrast passes WCAG**      | Body text ≥ 4.5:1, large text ≥ 3:1. `--pine-3` (36% alpha) is **decorative/eyebrow only** — never body copy     |
| 10  | **No overflow**               | No horizontal scroll at 360px; no clipped text; long names truncate with ellipsis                                |
| 11  | **No layout shift**           | Skeletons occupy the final height. CLS < 0.05                                                                    |
| 12  | **Native iOS feel preserved** | Momentum scrolling intact; sheets drag-to-dismiss; press states fire within 100ms; haptics on the spec'd events  |
| 13  | **Reduced motion honoured**   | `prefers-reduced-motion` swaps every animation for an instant state change                                       |

Checks 9 and 10 are automated where possible; the rest are a manual pass against the
frame plus the screenshot diff.

---

## 2 · Performance budgets

The new language adds blur, gradients, glass, shadows and motion. Without limits it
will look premium and feel slow — especially on the mid-range Android hardware most
Indian clinics run.

### Hard rules

| #   | Rule                                                    | Enforcement                                                                                     |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | **No screen below 55 FPS** while scrolling or animating | Manual DevTools capture per stage on a 4× CPU throttle                                          |
| 2   | **Max 2 backdrop-blur surfaces on screen at once**      | Spec uses exactly two: `.lgnav` and `.vmenu` — and they're never co-visible. Lint rule + review |
| 3   | **No nested backdrop filters**                          | A blurred element may not contain another. Review                                               |
| 4   | **No glass on scrolling lists or repeating items**      | Already `design-system.md` law; the migration removes `GlassCard` from `queue-cards`            |
| 5   | **Never animate `box-shadow`**                          | Animate `opacity` on a pseudo-element layer instead                                             |
| 6   | **Never animate `background` / gradients**              | Cross-fade two stacked layers instead                                                           |
| 7   | **No unnecessary re-renders**                           | Zustand selectors stay narrow; new components memoised where they sit in a list                 |

### Additional properties-to-avoid

Animate only `transform` and `opacity`. Anything touching `width`, `height`, `top`,
`left`, `filter` or `backdrop-filter` per frame is rejected in review.

### Budgets carried forward from `design-system.md` §14

Lighthouse mobile **Performance ≥ 90** (raised from 88), **Accessibility ≥ 95**,
LCP < 2.5s, CLS < 0.05, INP < 200ms — on `/phone`, `/home`, `/patients`.

---

## 3 · Numeric definition of done

"Matches the spec" is not a criterion. A page or stage is done only at these numbers.

| Metric                                 | Target                                             | Measured by                             |
| -------------------------------------- | -------------------------------------------------- | --------------------------------------- |
| Feature parity                         | **100%** of the page's Doc-1 rows still ✓          | manual checklist                        |
| Failing tests                          | **0**                                              | `pnpm test`                             |
| TypeScript errors                      | **0**                                              | `pnpm typecheck`                        |
| ESLint errors                          | **0**                                              | `pnpm lint`                             |
| Console errors/warnings in the browser | **0**                                              | manual pass                             |
| Lighthouse mobile Performance          | **≥ 90**                                           | per stage, on the 3 budget routes       |
| Lighthouse mobile Accessibility        | **≥ 95**                                           | per stage                               |
| Bundle growth vs the Stage-0 baseline  | **< 5%**                                           | `next build` output, recorded per stage |
| Visual regression screenshots          | **approved** — every diff read, no structural loss | `shots:compare`                         |

Bundle size is recorded once at Stage 0b and compared at every stage boundary.

---

## 4 · Business-logic protection

**Rule.** If a file contains both UI and business logic, the logic is extracted into a
hook or a `lib/` service **in its own commit, with tests green, before any restyling
touches that file.**

**A UI-migration commit may never also refactor business logic.** One commit changes
behaviour-preserving structure; the next changes pixels. Never both.

This makes `git bisect` meaningful: if a page breaks, the commit that broke it is
either "moved logic" or "restyled", never an ambiguous mix.

### Files this rule binds (identified in the audit)

| File                                              | Lines | Extraction required before restyle                                                  |
| ------------------------------------------------- | ----- | ----------------------------------------------------------------------------------- |
| `app/(app)/patients/[id]/page.tsx`                | 958   | Split 5 tab bodies + 6 sheets into their own files; queries into `lib/patients/`    |
| `components/voice/verification-card.tsx`          | 545   | Sub-components; editors already live in `lib/consult/editors.ts` — keep it that way |
| `app/(app)/lab/[caseId]/page.tsx`                 | 355   | Transition actions into `lib/lab/`                                                  |
| `app/(app)/clinic/templates/page.tsx`             | 304   | Template CRUD into a hook                                                           |
| `app/(app)/lab/vendors/page.tsx`                  | 290   | Vendor sheet + consent into components                                              |
| `app/(app)/messages/lab/page.tsx`                 | 280   | Verdict actions into a hook                                                         |
| `app/(app)/home/page.tsx`                         | 277   | `QuickTile` out; state derivation into `lib/queue/home-summary.ts` (partly there)   |
| `app/(app)/patients/[id]/plans/[planId]/page.tsx` | 265   | Plan actions into a hook                                                            |
| `app/(app)/lab/new/page.tsx`                      | 263   | Form logic into a hook                                                              |
| `app/(app)/patients/new/page.tsx`                 | 243   | Intake logic into a hook (schema already in `lib/`)                                 |

Each extraction is a separate commit tagged `refactor(no-visual-change)` and must
produce a **zero-pixel screenshot diff** — that is its proof of correctness.

---

## 5 · Stage exit criteria

A stage is complete only when **all** hold. Not "the code is written".

```
Stage <N> is complete only if:

  ✓ every page in the stage passes the §1 Design QA checklist
  ✓ every page in the stage passes the §3 numeric criteria
  ✓ all screenshots recaptured and every diff read and approved
  ✓ zero visual-diff failures (structural loss = failure; restyle = expected)
  ✓ zero accessibility regressions vs the stage's entry snapshot
  ✓ performance budgets (§2) hold on the stage's heaviest page
  ✓ every commit in the stage carries a §6 Migration Report
  ✓ the stage is tagged: ui-migration/stage-<N>
```

Tagging each stage means rollback to any stage boundary is one command.

---

## 5.1 · Verification ordering (learned in Stage 1)

`next build` and `next dev` share `apps/web/.next`. Running the build while the dev
server is live corrupts its client manifest — the running app starts throwing
`Could not find the module … in the React Client Manifest` and serves 500s until it
recompiles. It self-heals, but any screenshot captured in that window is garbage.

**Order every stage's verification like this:**

```
1. pnpm lint · typecheck · test        (no server needed)
2. STOP the dev server
3. pnpm build                          (bundle number for the report)
4. START the dev server
5. pnpm shots:current && shots:compare
6. commit
```

Never capture screenshots in the same window as a build.

---

## 6 · Per-commit Migration Report (mandatory)

**No commit is made without this.** It lives in the commit body, so the audit trail is
the git history itself — no separate document to drift.

### Template

```
ui-migration stage <N>.<M>: <page> → frame v9-<NN>

COMPONENTS MODIFIED
  - <path> — <what changed>
  - <path> — NEW

PAGES AFFECTED
  - <route> (direct)
  - <route> (indirect — shares <component>)

FEATURES VERIFIED
  - <feature> ✓   (Doc 1 row reference)
  ... every Doc-1 row belonging to this page

REGRESSION TESTS EXECUTED
  - pnpm lint      : PASS
  - pnpm typecheck : PASS
  - pnpm test      : <n> passed, 0 failed
  - <named regression tests touching this page>

SCREENSHOT COMPARISONS
  - <slug>: <changed | unchanged> — <one line on what moved>
  - structural loss: NONE

PERFORMANCE IMPACT
  - bundle: <±x.x%> vs stage-0 baseline
  - blur surfaces on screen: <n> (budget 2)
  - animated properties: transform/opacity only ✓
  - <Lighthouse numbers if a budget route>

ACCESSIBILITY CHECKS
  - touch targets ≥44px ✓
  - contrast WCAG AA ✓
  - focus order preserved ✓
  - sr-only labels on icon-only controls ✓
  - reduced-motion honoured ✓

REMAINING WORK
  - <anything deferred, with why>

KNOWN ISSUES
  - <anything accepted, with why> | NONE

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

A commit whose report says "structural loss: NONE" while the diff shows a missing
control is a **failed commit** — reverted, not patched forward.

---

## 7 · What this changes about Stage 0

Your rule — _nothing starts until `baseline/` exists_ — and the fact that the harness
is itself code creates an ordering problem. Resolved by splitting:

|              | Contents                                                                                                                               | Pixel change |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Stage 0a** | Governance docs · screenshot harness (3 scripts + package scripts) · additive seed extension for the 4 missing states · toolchain note | **zero**     |
| _(you)_      | `docker compose up -d` · `.env` · `db:migrate && db:seed` · `playwright install` · `pnpm shots:baseline`                               | —            |
| **Stage 0b** | 16 token groups · `design-system.md` §12.1 rewrite · 4 test repoints · bundle baseline recorded                                        | tokens only  |

Because 0a changes no pixels, a baseline captured after it is still a true "before".
The rule holds: **no token lands before `baseline/` exists.**
