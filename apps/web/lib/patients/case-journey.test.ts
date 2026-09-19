import { describe, expect, it } from "vitest";
import { caseJourney, type PlanSittingLike } from "./case-journey";

const sit = (over: Partial<PlanSittingLike>): PlanSittingLike => ({
  id: "s1",
  sittingNumber: 1,
  date: "2026-06-28T04:00:00Z",
  completed: false,
  notes: null,
  visitId: null,
  ...over,
});

describe("caseJourney", () => {
  it("marks completed sittings done and the live one now", () => {
    const j = caseJourney(
      [
        sit({ id: "a", sittingNumber: 1, completed: true, visitId: "v1" }),
        sit({ id: "b", sittingNumber: 2, visitId: "v2" }),
        sit({ id: "c", sittingNumber: 3 }),
      ],
      "RCT",
    );
    expect(j.map((s) => s.state)).toEqual(["done", "now", "ahead"]);
  });

  it("has no live checkpoint when every sitting is complete", () => {
    const j = caseJourney([sit({ completed: true, visitId: "v1" })], "RCT");
    expect(j[0]!.state).toBe("done");
    expect(j.some((s) => s.state === "now")).toBe(false);
  });

  it("does not date a sitting nobody has attended", () => {
    // An unstarted sitting's `date` is when it was planned. Printing it reads as a visit
    // that happened.
    const j = caseJourney([sit({ sittingNumber: 3 })], "RCT");
    expect(j[0]!.subtitle).toBeUndefined();
  });

  it("titles each step with its number and procedure", () => {
    const j = caseJourney(
      [sit({ sittingNumber: 2, completed: true })],
      "Crown",
    );
    expect(j[0]!.title).toBe("Sitting 2 · Crown");
  });
});

describe("caseJourney respects the clinical boundary (B4)", () => {
  const rows = [
    sit({ id: "a", sittingNumber: 1, completed: true, visitId: "v1" }),
  ];

  it("shows a doctor's notes when the API sent them", () => {
    const j = caseJourney(
      [{ ...rows[0]!, notes: "extirpation, dressing" }],
      "RCT",
    );
    expect(j[0]!.subtitle).toContain("extirpation, dressing");
  });

  it("shows reception the operational line and no clinical prose", () => {
    // The API already returned notes: null for this role — it never decrypted them. This
    // asserts the component does not reintroduce them from anywhere else.
    const j = caseJourney([{ ...rows[0]!, notes: null }], "RCT");
    expect(j[0]!.subtitle).toBe("28 Jun");
    expect(j[0]!.subtitle).not.toContain("extirpation");
  });

  it("keeps the journey itself visible to both roles", () => {
    // Reception still needs to see where treatment has got to — they book the next one.
    const recep = caseJourney(
      [
        { ...rows[0]!, notes: null },
        sit({ id: "b", sittingNumber: 2, visitId: "v2", notes: null }),
      ],
      "RCT",
    );
    expect(recep).toHaveLength(2);
    expect(recep.map((s) => s.state)).toEqual(["done", "now"]);
    expect(recep[0]!.title).toBe("Sitting 1 · RCT");
  });
});
