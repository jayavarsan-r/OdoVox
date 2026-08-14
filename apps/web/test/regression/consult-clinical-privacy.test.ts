import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canAccess, tabsForRole } from "../../lib/rbac";
import { flagChips, flagLabel } from "../../lib/queue/medical-flags";
import { WEB_ROOT } from "./read-screen";

/**
 * Owner ruling on #69: keep the allergy indicator on the in-chair card, and do NOT expose
 * medical flags to receptionists through /consult.
 *
 * Both halves matter together. The indicator exists so the doctor about to record sees a
 * penicillin allergy before they prescribe; the RBAC change exists so adding it does not
 * quietly widen who can read clinical detail. /consult used to be a SHARED route — absent
 * from the receptionist tab bar, but reachable by URL — which is exactly the kind of gap
 * that turns a safety feature into a privacy leak.
 */
describe("/consult is a clinical surface — doctor and admin only", () => {
  it("DOCTOR can access /consult", () => {
    expect(canAccess("/consult", "DOCTOR")).toBe(true);
    expect(canAccess("/consult/abc123", "DOCTOR")).toBe(true);
  });

  it("ADMIN can access /consult", () => {
    expect(canAccess("/consult", "ADMIN")).toBe(true);
    expect(canAccess("/consult/abc123", "ADMIN")).toBe(true);
  });

  it("RECEPTIONIST cannot access /consult, including deep links", () => {
    // The deep link is the whole point: the tab bar never offered it, so a URL was the
    // only way in, and it worked.
    expect(canAccess("/consult", "RECEPTIONIST")).toBe(false);
    expect(canAccess("/consult/abc123", "RECEPTIONIST")).toBe(false);
  });

  it("no receptionist tab routes into the clinical surface", () => {
    for (const tab of tabsForRole("RECEPTIONIST")) {
      expect(canAccess(tab.href, "RECEPTIONIST")).toBe(true);
      expect(tab.href.startsWith("/consult")).toBe(false);
    }
  });
});

describe("the allergy indicator uses existing patient medicalFlags", () => {
  const card = readFileSync(
    join(WEB_ROOT, "components", "queue", "queue-cards.tsx"),
    "utf8",
  );

  it("renders from medicalFlags and invents no new medical field", () => {
    expect(card).toMatch(/medicalFlags/);
    // The encrypted allergies column must never reach the queue payload or this card.
    expect(card).not.toMatch(/\ballergiesEnc\b/);
    expect(card).not.toMatch(/patient\.allergies\b/);
  });

  it('leads with the allergy and names it, rather than saying "Allergy"', () => {
    expect(flagLabel("PENICILLIN_ALLERGY")).toBe("Penicillin allergy");
    const { chips } = flagChips(["HYPERTENSION", "PENICILLIN_ALLERGY"]);
    expect(chips[0]).toEqual({ label: "Penicillin allergy", tone: "crit" });
  });

  it("stays concise — a long history is capped, never silently truncated", () => {
    const { chips, more } = flagChips(
      ["PENICILLIN_ALLERGY", "DIABETES", "HYPERTENSION", "ASTHMA"],
      2,
    );
    expect(chips).toHaveLength(2);
    expect(more).toBe(2);
  });

  it("says nothing when the patient has no flags", () => {
    expect(flagChips([])).toEqual({ chips: [], more: 0 });
    expect(flagChips(["", "  "])).toEqual({ chips: [], more: 0 });
  });
});

describe("no medical flag leaks through the receptionist workflow", () => {
  const RECEPTION_SURFACES = [
    ["app", "(app)", "today", "page.tsx"],
    ["components", "queue", "checkout-sheet.tsx"],
    ["components", "queue", "walk-in-sheet.tsx"],
  ];

  it("no receptionist-facing surface READS a patient's medicalFlags", () => {
    // Forbids reading flags off a patient, not the identifier appearing at all — the
    // walk-in sheet legitimately passes `medicalFlags: []` when creating a patient, which
    // writes nothing and displays nothing.
    for (const segs of RECEPTION_SURFACES) {
      const src = readFileSync(join(WEB_ROOT, ...segs), "utf8");
      expect(src, `${segs.join("/")} reads patient medicalFlags`).not.toMatch(
        /\.\s*medicalFlags\b/,
      );
      expect(src, `${segs.join("/")} destructures medicalFlags`).not.toMatch(
        /\{[^}]*\bmedicalFlags\b[^}]*\}\s*=/,
      );
    }
  });

  it("the reception queue card is a different component from the clinical one", () => {
    // If /today ever renders InChairCard the flags would travel with it, so the boundary
    // is asserted rather than assumed.
    const today = readFileSync(
      join(WEB_ROOT, "app", "(app)", "today", "page.tsx"),
      "utf8",
    );
    expect(today).not.toMatch(/InChairCard/);
  });
});
