import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tabsForRole } from "../../lib/rbac";

/**
 * Locked design (§6 / §12.1): the lime pill shows ONLY on the active tab, with the
 * label next to its icon. Inactive tabs are icon-only and muted — their label stays
 * in the DOM as `sr-only` (acceptable per spec) but is never visible.
 *
 * vitest runs in a node env (no DOM — see vitest.config.ts), so we assert the data
 * (tabsForRole) and the render contract by reading the component source. The thing
 * we guard against is the Phase 2.6 regression where every tab rendered a visible
 * `{tab.label}` (stacked below the icon via flex-col).
 */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tabsSrc = readFileSync(
  join(webRoot, "components", "app-shell", "bottom-tabs.tsx"),
  "utf8",
);

describe("bottom tabs — active-only label", () => {
  /**
   * Repointed in Phase 10 Task 5 for the v9 nav: FOUR tabs plus the orb, in every
   * nav instance from frame 12 onward. Lab, Clinic and Billing moved to /more.
   *
   * The core assertion — a visible label on the active tab only — is unchanged. That
   * is the Phase 2.6 regression this file exists to prevent.
   */
  it("each role has exactly 4 tabs with the v9 labels", () => {
    expect(tabsForRole("DOCTOR").map((t) => t.label)).toEqual([
      "Flow",
      "Patients",
      "Schedule",
      "More",
    ]);
    expect(tabsForRole("RECEPTIONIST").map((t) => t.label)).toEqual([
      "Today",
      "Patients",
      "Schedule",
      "More",
    ]);
  });

  it("keeps Lab, Clinic and Billing reachable — they lost a tab slot, not their route", () => {
    // Global Constraint 1: no route disappears. They live in the /more hub (frame 70)
    // and stay directly linkable.
    for (const role of ["DOCTOR", "RECEPTIONIST"] as const) {
      const hrefs = tabsForRole(role).map((t) => t.href);
      expect(hrefs).toContain("/more");
      expect(hrefs).not.toContain("/lab");
    }
  });

  it('with active="home" only the Flow tab would surface a visible label', () => {
    // The visible label is gated behind `active` — exactly the active tab renders it.
    const doctor = tabsForRole("DOCTOR");
    const active = doctor.find((t) => t.href === "/home");
    expect(active?.label).toBe("Flow");
    // The other three tabs are not the active one → their label is sr-only.
    expect(doctor.filter((t) => t.href !== "/home")).toHaveLength(3);
  });

  it("renders the visible label only inside the active branch (not unconditionally)", () => {
    // The Phase 2.6 regression rendered `{tab.label}` for every tab. The restored
    // design renders the visible label only within `active ? (...)`.
    expect(tabsSrc).toMatch(/active \? \(/);
    // The visible label lives in a motion.span that slides its width in.
    expect(tabsSrc).toMatch(
      /animate=\{\{ opacity: 1, width: ["']auto["'] \}\}[\s\S]*?\{tab\.label\}/,
    );
    // Inactive tabs keep the label only for screen readers.
    expect(tabsSrc).toMatch(/sr-only[^>]*>\{tab\.label\}/);
    // No stacked-below-icon layout (the regression used per-tab flex-col).
    expect(tabsSrc).not.toMatch(/flex-1 flex-col/);
  });

  it("puts the lime capsule (icon + label) behind the active tab only", () => {
    expect(tabsSrc).toMatch(/layoutId="tab-pill"/);
    expect(tabsSrc).toMatch(/bg-lime/);
    // The active capsule pads horizontally so the label sits NEXT TO the icon, not below.
    expect(tabsSrc).toMatch(/active \? .gap-2 px-5. : .w-10./);
  });

  it("uses the v9 glass pill, one of only two blurred surfaces app-wide", () => {
    // Perf budget (governance §2): the nav and the voice menu. Nothing else.
    expect(tabsSrc).toMatch(/backdrop-blur-nav/);
    expect(tabsSrc).toMatch(/h-nav\b/);
    expect(tabsSrc).toMatch(/rounded-nav/);
    expect(tabsSrc).toMatch(/h-nav-capsule/);
  });
});
