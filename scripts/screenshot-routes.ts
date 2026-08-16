import type { Page } from "@playwright/test";

/**
 * The screenshot route table — the single source of truth for what gets captured.
 *
 * Slugs are stable and match the "Shot" column in docs/migration/03-visual-migration-plan.md.
 * Renaming a slug orphans its baseline, so don't: add a new one instead.
 */

export type Role = "doctor" | "receptionist" | "anon";

export interface Shot {
  /** Stable id — becomes <slug>.png. Matches Doc 3's Shot column. */
  slug: string;
  /** Web path to visit. */
  path: string;
  /** Which seeded session to use. */
  role: Role;
  /** Design frame this shot is compared against (documentation only). */
  frame: string;
  /**
   * Optional: drive the page into a sub-state (open a sheet, switch a tab).
   * Runs after navigation settles. Throwing here fails just this shot.
   */
  prepare?: (page: Page) => Promise<void>;
  /**
   * Set when the surface does not exist yet (spec-only frames, stages 14–17).
   * Skipped by the capture run until the stage that builds it flips this off.
   */
  pending?: true;
  /**
   * This screen redirects away by design — it exists to be passed through, not landed
   * on. Capture at DOM-ready instead of network-idle (the redirect fires the moment the
   * network resolves), and exempt it from the redirect guard, which is otherwise right
   * to treat a changed path as a wrong-screen capture.
   *
   * Only the splash qualifies. Do not reach for this to silence a redirect you did not
   * expect — that guard has already caught eight wrong-screen baselines.
   */
  transient?: true;
}

/**
 * Start a real consultation and begin recording.
 *
 * From /consult: "Record" starts the consultation for whoever is in the chair and routes
 * to /consult/{id}; the mic button then requests permission and begins capture. Both are
 * the real buttons a doctor taps.
 */
/**
 * Land the consult screen on IDLE, using only affordances a doctor actually has.
 *
 * `init()` rehydrates a consultation from the server, which is correct: a doctor who
 * walks back into a consultation already at review should see the review, not a fresh
 * record button. But the queue hands the harness whichever visit is at the top, and a
 * previous capture run may have left that consultation mid-pipeline — so the run before
 * this one decides which screen this one starts on.
 *
 * The fix is to walk back the way a doctor would: every non-IDLE state on this screen
 * offers a route to re-record, so click through them until the record button appears.
 * Nothing here injects state; each click is a real control on a real screen.
 */
async function resetToIdle(page: Page): Promise<void> {
  const idle = page.getByText(/Tap to record/i);
  // Ordered by how far along the pipeline the state is, so the deepest screen resolves
  // first. VERIFY asks for a second click when the card has unsaved edits.
  const exits = [
    /^Re-record$/i,
    /Discard edits & re-record\?/i,
    /Record again instead/i,
    /^Cancel$/i,
  ];

  /**
   * IDLE is also the store's DEFAULT, so a bare visibility check passes on the first
   * paint — before `init()`'s rehydrate has come back — and then the real state lands
   * and the record button vanishes under the click. Idle only counts if it survives the
   * rehydrate, so require it to still be there after the network goes quiet.
   */
  const settledIdle = async () => {
    if (!(await idle.isVisible().catch(() => false))) return false;
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    return idle.isVisible().catch(() => false);
  };

  for (let attempt = 0; attempt < 6; attempt++) {
    if (await settledIdle()) return;
    let clicked = false;
    for (const name of exits) {
      const exit = page.getByRole("button", { name });
      if (await exit.first().isVisible().catch(() => false)) {
        await exit.first().click();
        clicked = true;
        break;
      }
    }
    await page.waitForTimeout(clicked ? 400 : 800);
  }

  const reached = await page
    .locator("main")
    .innerText()
    .catch(() => "<unreadable>");
  throw new Error(
    "consult screen never settled on IDLE — no re-record affordance was reachable from " +
      `the state the previous run left this consultation in. On screen: ${JSON.stringify(
        reached.replace(/\s+/g, " ").slice(0, 200),
      )}`,
  );
}

const startRecording = async (page: Page) => {
  // No Record button means no one is in the chair — which is exactly where D7 leaves the
  // queue, since confirming a consultation sends that patient to checkout. Call the next
  // waiting patient in first, the way a doctor would. Both are real queue controls; no
  // state is injected to make the next shot work.
  const record = page.getByRole("button", { name: /^record$/i });
  if (!(await record.first().isVisible().catch(() => false))) {
    const callIn = page.getByRole("button", { name: /call in/i }).first();
    if (!(await callIn.isVisible().catch(() => false))) {
      throw new Error(
        "the queue is empty — nobody in the chair and nobody waiting. D7 confirms a " +
          "patient to checkout on every run, so a few full capture cycles drain the seeded " +
          "queue. Re-seed with `pnpm db:seed` and run again; this is dev data state, not a " +
          "regression.",
      );
    }
    await callIn.click();
    await record.first().waitFor({ timeout: 15_000 });
  }
  await record.first().click();
  await page.waitForURL(/\/consult\/[^/]+$/, { timeout: 15_000 });
  await resetToIdle(page);
  await page.getByRole("button", { name: /start recording/i }).click();
  await page.getByText(/REC/).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(400);
};

/** Tap a tab by its visible label on the patient-detail page. */
const patientTab = (label: string) => async (page: Page) => {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await page.waitForTimeout(400);
};

/**
 * Open the first row of a list that actually navigates, then ASSERT we landed.
 *
 * List rows here are `<button onClick={router.push}>`, not anchors — an href-based
 * selector silently matches nothing and captures the LIST page while looking like a
 * success. A plausible-but-wrong screenshot is worse than a crash, so this throws
 * when nothing navigates.
 */
// Rows are taller than filter chips and nav items (~34-40px), which is the distinction
// that matters — clicking a chip re-filters the list out from under us. 48px, not 56:
// removing the medical-flag chip from reception rows (ruling #61) made a row without a
// complaint about 52px, and the old threshold silently skipped every one of them.
const ROW_MIN_HEIGHT = 48;

const openFirstRow = (urlPattern: RegExp) => async (page: Page) => {
  const start = page.url();
  const candidates = page.locator("a, button");
  const n = Math.min(await candidates.count(), 60);

  for (let i = 0; i < n; i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;

    // Height is what separates a list row from a filter chip. Clicking chips is
    // actively harmful here: "Lab pending" re-filters the list out from under us,
    // so a click-everything strategy destroys the very rows it is looking for.
    const box = await el.boundingBox().catch(() => null);
    if (!box || box.height < ROW_MIN_HEIGHT) continue;

    const text = ((await el.textContent().catch(() => "")) ?? "").trim();
    if (text.length < 4) continue;

    await el.click({ timeout: 3000 }).catch(() => undefined);
    await page.waitForURL(urlPattern, { timeout: 4000 }).catch(() => undefined);

    if (urlPattern.test(page.url())) {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      return;
    }
    if (page.url() !== start) {
      await page.goBack({ waitUntil: "networkidle" }).catch(() => undefined);
    }
  }
  throw new Error(
    `openFirstRow: no row >=${ROW_MIN_HEIGHT}px navigated to ${urlPattern} from ${start}`,
  );
};

export const SHOTS: Shot[] = [
  // ── A · Entry ────────────────────────────────────────────────────────────
  {
    slug: "A1-splash",
    path: "/",
    role: "anon",
    frame: "v9-01",
    transient: true,
  },
  { slug: "A2-welcome", path: "/welcome", role: "anon", frame: "v9-02" },
  {
    /**
     * Frame 03 draws a number MID-TYPE ("98401 2", cursor showing) with the CTA live.
     * Capturing the empty default compared the frame's active state against our resting
     * one and read as a mismatch that was never real. Types, never submits — so this
     * costs no OTP.
     */
    slug: "A3-phone",
    path: "/phone",
    role: "anon",
    frame: "v9-03",
    prepare: async (page) => {
      await page.getByLabel("Mobile number").fill("9840123456");
      await page.waitForTimeout(200);
    },
  },
  {
    /**
     * /otp reads its number from the onboarding store, not the URL, so it cannot be
     * reached by direct navigation — it redirects to /phone. The shot has to walk the
     * form, which is also a truer capture: this is how a user actually arrives.
     */
    slug: "A4-otp",
    path: "/phone",
    role: "anon",
    frame: "v9-04",
    prepare: async (page) => {
      await page.getByLabel("Mobile number").fill("9000000001");
      await page.getByRole("button", { name: "Send code" }).click();
      await page.waitForURL(/\/otp$/, { timeout: 8000 });
      await page.waitForTimeout(400);
    },
  },
  {
    slug: "A5-otp-error",
    path: "/phone",
    role: "anon",
    frame: "v9-05",
    prepare: async (page) => {
      await page.getByLabel("Mobile number").fill("9000000001");
      await page.getByRole("button", { name: "Send code" }).click();
      await page.waitForURL(/\/otp$/, { timeout: 8000 });
      // A deliberately wrong code drives the error state: crit outlines, the factual
      // line, and resend unlocked immediately (frame 05).
      //
      // This used to be `getByLabel(/verification code/i).fill(...).catch(() => undefined)`.
      // Two elements carry that label — the hidden input and its container — so the fill
      // threw a strict-mode violation, the catch swallowed it, and A5 captured the CLEAN
      // OTP screen while reporting success. Exactly the wrong-screen class the redirect
      // guard exists to stop. Target the input exactly, and ASSERT the error rendered.
      await page
        .getByLabel("Verification code", { exact: true })
        .fill("000000");
      await page
        .getByRole("alert")
        .filter({ hasText: /didn't match/i })
        .waitFor({ timeout: 10_000 });
    },
  },
  {
    slug: "A6-unlock",
    path: "/unlock",
    role: "anon",
    frame: "v9-06",
    pending: true,
  },

  // ── B · Clinic setup ─────────────────────────────────────────────────────
  { slug: "B1-role", path: "/role", role: "anon", frame: "v9-07" },
  {
    slug: "B2-clinic-choice",
    path: "/clinic-choice",
    role: "anon",
    frame: "—",
  },
  {
    slug: "B3-create-1",
    path: "/clinic-create/step-1-basics",
    role: "anon",
    frame: "v9-08",
  },
  {
    slug: "B4-create-2",
    path: "/clinic-create/step-2-hours",
    role: "anon",
    frame: "v9-08",
  },
  {
    slug: "B5-create-3",
    path: "/clinic-create/step-3-profile",
    role: "anon",
    frame: "v9-08",
  },
  {
    /**
     * /clinic-join needs a role in the onboarding store, so a direct visit bounces to
     * /role. Reached the way a user reaches it: pick the front-desk role, which routes
     * here. (Found by the redirect guard — this shot had been capturing /role.)
     *
     * Two taps, not one: frame 07 is select-then-confirm, so picking the card only
     * selects it and the sticky CTA commits. Reverting deviation 12 broke this step,
     * which is the harness working as intended — a prepare step encodes the real
     * interaction, so changing the interaction must change the step.
     */
    slug: "B6-join",
    path: "/role",
    role: "anon",
    frame: "v9-09",
    prepare: async (page) => {
      await page.getByRole("button", { name: /front desk/i }).click();
      await page
        .getByRole("button", { name: /continue as front desk/i })
        .click();
      await page.waitForURL(/\/clinic-join$/, { timeout: 8000 });
      await page.waitForTimeout(400);
    },
  },
  {
    /**
     * PENDING: /done reads the just-created clinic from the onboarding result store,
     * so it is only reachable by completing the create wizard in-session — a seeded
     * doctor who already has a clinic bounces to /welcome. Capturing it truthfully
     * means driving the whole wizard, which also creates a clinic per run.
     * Left pending rather than shipping another screenshot of the wrong screen: the
     * redirect guard found this one had been capturing /welcome all along.
     */
    slug: "B7-done",
    path: "/done",
    role: "doctor",
    frame: "v9-11",
    pending: true,
  },
  {
    slug: "B8-first-day",
    path: "/first-day",
    role: "doctor",
    frame: "v9-12",
    pending: true,
  },
  {
    slug: "B9-pending",
    path: "/clinic-join?state=pending",
    role: "anon",
    frame: "v9-10",
    pending: true,
  },

  // ── C · Home / Flow ──────────────────────────────────────────────────────
  { slug: "C1-home-inchair", path: "/home", role: "doctor", frame: "v9-13" },
  {
    slug: "C7-week-review",
    path: "/week",
    role: "doctor",
    frame: "v9-20",
    pending: true,
  },

  // ── D · Consult pipeline ─────────────────────────────────────────────────
  { slug: "D1-consult", path: "/consult", role: "doctor", frame: "v9-21" },
  {
    /**
     * Frames 23-26 are STATES inside a live consultation, not routes — the last big
     * block of the 49 nothing could reach.
     *
     * Driven entirely through the real application: tap Record on the in-chair patient
     * (which starts a real consultation), grant the microphone (Chromium's fake capture
     * device, configured at launch), and let the consult store walk its own machine. No
     * state is injected and no production code knows the harness exists.
     *
     * Each run does create a consultation for the seeded in-chair patient. That is a
     * real side effect on a dev database, and it is the price of not faking the state.
     */
    slug: "D2-recording",
    path: "/consult",
    role: "doctor",
    frame: "v9-23",
    prepare: startRecording,
  },
  {
    slug: "D3-paused",
    path: "/consult",
    role: "doctor",
    frame: "v9-24",
    prepare: async (page) => {
      await startRecording(page);
      await page.getByRole("button", { name: /pause/i }).click();
      await page.getByText(/PAUSED/).waitFor({ timeout: 5000 });
    },
  },
  {
    slug: "D4-processing",
    path: "/consult",
    role: "doctor",
    frame: "v9-25",
    prepare: async (page) => {
      await startRecording(page);
      await page.waitForTimeout(1200); // capture something real to send
      await page.getByRole("button", { name: /finish/i }).click();
      await page.getByRole("button", { name: /save findings/i }).click();
      await page.getByText(/Processing/).waitFor({ timeout: 10_000 });
    },
  },
  {
    /**
     * Frames 27-31 — the verification card. Reached the only honest way: record, finish,
     * send, and let the real pipeline run. On dev's mock STT + mock extractor that takes
     * a couple of seconds and produces real structured data, so the card renders the same
     * fields a live Sarvam+Gemini run would.
     *
     * Task 17 splits this component with a zero-pixel-change requirement, and this shot
     * is that task's proof. It is deliberately captured BEFORE the refactor.
     */
    slug: "D6-verify",
    path: "/consult",
    role: "doctor",
    frame: "v9-30",
    prepare: async (page) => {
      await startRecording(page);
      await page.waitForTimeout(1200);
      await page.getByRole("button", { name: /finish/i }).click();
      await page.getByRole("button", { name: /save findings/i }).click();
      // The whole pipeline: upload → STT → extraction → READY over SSE. Generous, because
      // a real provider run is not instant and this must not be a flaky gate.
      //
      // Anchored on Re-record, not on the CTA: the verification CTA currently reads
      // "Save findings", which is the SAME label the recorder's STOPPED state uses for a
      // completely different action. Re-record only exists on the verification card.
      await page
        .getByRole("button", { name: /^re-record$/i })
        .waitFor({ timeout: 60_000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(600);
    },
  },
  {
    /**
     * Frame 31 — saved. Reached by actually committing: the preview opens, the doctor
     * confirms, and the confirm transaction writes the record. This is a real write to
     * the dev database, which is the price of not faking the screen.
     */
    slug: "D7-saved",
    path: "/consult",
    role: "doctor",
    frame: "v9-31",
    prepare: async (page) => {
      await startRecording(page);
      await page.waitForTimeout(1200);
      await page.getByRole("button", { name: /finish/i }).click();
      await page.getByRole("button", { name: /save findings/i }).click();
      await page.getByRole("button", { name: /^re-record$/i }).waitFor({ timeout: 60_000 });
      await page.getByRole("button", { name: /confirm & save/i }).click();
      await page.getByRole("button", { name: /save & send to front desk/i }).click();
      await page.getByText(/Saved to /).waitFor({ timeout: 30_000 });
      await page.waitForTimeout(500);
    },
  },
  {
    slug: "D5-failed",
    path: "/consult",
    role: "doctor",
    frame: "v9-26",
    prepare: async (page) => {
      // Frame 26 is "The network dropped." Reproduce exactly that: fail the presign
      // call. The store's own error path does the rest — nothing is stubbed in the app.
      await page.route("**/consultations/audio/presign", (r) => r.abort());
      await startRecording(page);
      await page.waitForTimeout(1200);
      await page.getByRole("button", { name: /finish/i }).click();
      await page.getByRole("button", { name: /save findings/i }).click();
      await page.getByText(/Couldn't process/).waitFor({ timeout: 10_000 });
    },
  },

  // ── E · Patients & cases ─────────────────────────────────────────────────
  { slug: "E1-patients", path: "/patients", role: "doctor", frame: "v9-32" },
  {
    slug: "E2-search",
    path: "/patients?search=a",
    role: "doctor",
    frame: "v9-33",
  },
  {
    /**
     * Frame 34 — the no-match state. It was one of the 49 frames nothing could reach:
     * a state, not a route. `?search=` opens the search mode and seeds the query, so a
     * term nobody matches drives it with no new machinery.
     */
    slug: "E3-search-no-match",
    path: "/patients?search=Ramesh%20Kum",
    role: "doctor",
    frame: "v9-34",
  },
  {
    slug: "E4-new-patient",
    path: "/patients/new",
    role: "doctor",
    frame: "v9-35",
  },
  {
    /**
     * Frame 36 — the form after voice intake, with the lime spine on every field that
     * arrived by dictation. Driven through the real intake pipeline: press the mic, let
     * the recorder capture, stop, and let the extraction fill the form. Nothing is typed
     * in and no field is pre-set.
     */
    slug: "E5-new-patient-voiced",
    path: "/patients/new",
    role: "doctor",
    frame: "v9-36",
    prepare: async (page) => {
      await page.getByRole("button", { name: /speak patient details/i }).first().click();
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: /stop/i }).first().click();
      // Wait for the NAME field to actually carry a value, not for the toast. The toast
      // fires either way, and "success message over an empty form" is precisely the state
      // this shot exists to rule out — waiting on the toast would have captured it.
      await page.waitForFunction(
        () => (document.querySelector("#name") as HTMLInputElement | null)?.value !== "",
        undefined,
        { timeout: 60_000 },
      );
      await page.waitForTimeout(600);
    },
  },
  {
    slug: "E6-patient-overview",
    path: "/patients",
    role: "doctor",
    frame: "v9-37",
    prepare: openFirstRow(/\/patients\/[^/]+$/),
  },
  {
    slug: "E7-patient-cases",
    path: "/patients",
    role: "doctor",
    frame: "v9-38",
    prepare: async (page) => {
      await openFirstRow(/\/patients\/[^/]+$/)(page);
      await patientTab("Cases")(page);
    },
  },
  {
    slug: "E8-patient-teeth",
    path: "/patients",
    role: "doctor",
    frame: "v9-40",
    prepare: async (page) => {
      await openFirstRow(/\/patients\/[^/]+$/)(page);
      await patientTab("Teeth")(page);
      // Frame 40 IS the selected state: the chart with a tooth open and its status panel
      // below. Tapping a real tooth also proves the interaction survived the restyle —
      // selection, the panel, and the plan link all come from the same click a doctor makes.
      await page.getByRole("button", { name: /^Tooth 36\b/ }).first().click();
      await page.getByText(/Save/).first().waitFor({ timeout: 10_000 });
      await page.waitForTimeout(300);
    },
  },
  {
    slug: "E9-patient-media",
    path: "/patients",
    role: "doctor",
    frame: "—",
    prepare: async (page) => {
      await openFirstRow(/\/patients\/[^/]+$/)(page);
      await patientTab("Media")(page);
    },
  },
  {
    slug: "E10-patient-billing",
    path: "/patients",
    role: "doctor",
    frame: "v9-41",
    prepare: async (page) => {
      await openFirstRow(/\/patients\/[^/]+$/)(page);
      await patientTab("Billing")(page);
    },
  },
  {
    slug: "E12-history",
    path: "/patients/history",
    role: "doctor",
    frame: "v9-42",
    pending: true,
  },

  // ── G · Schedule ─────────────────────────────────────────────────────────
  {
    slug: "G1-schedule-day",
    path: "/schedule",
    role: "doctor",
    frame: "v9-46",
  },
  {
    slug: "G2-schedule-multi",
    path: "/schedule",
    role: "receptionist",
    frame: "v9-47",
  },

  // ── H · Reception & money ────────────────────────────────────────────────
  { slug: "H1-today", path: "/today", role: "receptionist", frame: "v9-50" },
  {
    slug: "H5-billing",
    path: "/billing",
    role: "receptionist",
    frame: "v9-54",
  },
  {
    slug: "H6-outstanding",
    path: "/billing/outstanding",
    role: "receptionist",
    frame: "v9-55",
  },

  // ── I · Lab ──────────────────────────────────────────────────────────────
  { slug: "I1-lab", path: "/lab", role: "doctor", frame: "v9-56" },
  {
    slug: "I3-lab-case",
    path: "/lab",
    role: "doctor",
    frame: "v9-58",
    prepare: openFirstRow(/\/lab\/[^/]+$/),
  },
  { slug: "I4-lab-new", path: "/lab/new", role: "doctor", frame: "v9-59" },
  { slug: "I6-vendors", path: "/lab/vendors", role: "doctor", frame: "v9-61" },

  // ── J · Messages ─────────────────────────────────────────────────────────
  { slug: "J1-messages", path: "/messages", role: "doctor", frame: "v9-62" },
  {
    slug: "J4-lab-inbox",
    path: "/messages/lab",
    role: "doctor",
    frame: "v9-65",
  },
  {
    slug: "J5-followups",
    path: "/follow-ups",
    role: "doctor",
    frame: "v9-66",
    pending: true,
  },

  // ── K · Inventory ────────────────────────────────────────────────────────
  { slug: "K1-inventory", path: "/inventory", role: "doctor", frame: "v9-67" },
  {
    slug: "K2-item",
    path: "/inventory",
    role: "doctor",
    frame: "v9-68",
    prepare: openFirstRow(/\/inventory\/[^/]+$/),
  },
  { slug: "K4-item-new", path: "/inventory/new", role: "doctor", frame: "—" },
  {
    slug: "K5-categories",
    path: "/inventory/categories",
    role: "doctor",
    frame: "—",
  },

  // ── L · Management ───────────────────────────────────────────────────────
  { slug: "L1-more", path: "/more", role: "doctor", frame: "v9-70" },
  { slug: "L2-clinic", path: "/clinic", role: "doctor", frame: "v9-70" },
  {
    slug: "L3-whatsapp",
    path: "/clinic/whatsapp",
    role: "doctor",
    frame: "v9-72",
  },
  {
    slug: "L4-availability",
    path: "/clinic/availability",
    role: "doctor",
    frame: "v9-73",
  },
  {
    slug: "L5-dayoff",
    path: "/clinic/day-off",
    role: "doctor",
    frame: "v9-74",
  },
  {
    slug: "L6-templates",
    path: "/clinic/templates",
    role: "doctor",
    frame: "v9-75",
  },
  {
    slug: "L7-account",
    path: "/account",
    role: "doctor",
    frame: "v9-76",
    pending: true,
  },
  {
    slug: "L9-team",
    path: "/clinic/team",
    role: "doctor",
    frame: "v9-71",
    pending: true,
  },

  // ── M · System ───────────────────────────────────────────────────────────
  {
    slug: "M3-notifications",
    path: "/notifications",
    role: "doctor",
    frame: "v9-80",
    pending: true,
  },
];

/** Seeded logins (packages/db/prisma/seed.ts). */
export const SESSIONS: Record<
  Exclude<Role, "anon">,
  { phone: string; label: string }
> = {
  doctor: { phone: "9000000001", label: "Dr. Asha Menon" },
  receptionist: { phone: "9000000002", label: "Ravi Kumar" },
};

export const active = (): Shot[] => SHOTS.filter((s) => !s.pending);
