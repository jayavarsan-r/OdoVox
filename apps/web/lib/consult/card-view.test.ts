import { describe, expect, it } from "vitest";
import type { ClinicalExtraction } from "@odovox/types";
import {
  invalidFields,
  medicineSummary,
  parseTeethInput,
  previewLines,
} from "./card-view";
import type { SafetyViewItem } from "./safety-view";

/**
 * These four functions were inline in verification-card.tsx and therefore untested. They
 * decide what a doctor reads immediately before committing a clinical record, so each one
 * gets the case that would actually hurt someone.
 */

const base: ClinicalExtraction = {
  procedure: "RCT",
  teeth: [36],
  sittingCurrent: 2,
  sittingTotal: 3,
  status: "IN_PROGRESS",
  continuesPlanId: null,
  prescriptions: [],
  toothStatusUpdates: [],
  clarifications: [],
  safetyWarnings: [],
  followUp: null,
  estimatedCostPaise: null,
  notes: null,
  labCaseSuggestion: null,
};

const warn = (over: Partial<SafetyViewItem>): SafetyViewItem =>
  ({
    code: "x",
    message: "m",
    blocking: false,
    resolved: false,
    field: undefined,
    ...over,
  }) as SafetyViewItem;

describe("invalidFields", () => {
  it("marks a field only while its blocking warning is unresolved", () => {
    expect(invalidFields([warn({ blocking: true, field: "teeth" })])).toEqual(
      new Set(["teeth"]),
    );
    // Resolved warnings re-render with a check — the row must come out of the red state,
    // or a doctor who fixed the problem still cannot save.
    expect(
      invalidFields([warn({ blocking: true, resolved: true, field: "teeth" })])
        .size,
    ).toBe(0);
  });

  it("ignores non-blocking warnings — advisory text must not red-line a field", () => {
    expect(
      invalidFields([warn({ blocking: false, field: "teeth" })]).size,
    ).toBe(0);
  });

  it("ignores warnings with no field to attach to", () => {
    expect(invalidFields([warn({ blocking: true })]).size).toBe(0);
  });
});

describe("parseTeethInput", () => {
  it("accepts commas, spaces, or both", () => {
    expect(parseTeethInput("26, 38")).toEqual([26, 38]);
    expect(parseTeethInput("26 38")).toEqual([26, 38]);
    expect(parseTeethInput("26,38")).toEqual([26, 38]);
  });

  it("drops anything that is not a positive whole tooth number", () => {
    // The dangerous case: a typo must not silently become a real tooth. "3x" and "0"
    // vanish rather than landing in the record as tooth 3 or tooth 0.
    expect(parseTeethInput("26, 3x, 0, -4, 2.5")).toEqual([26]);
    expect(parseTeethInput("")).toEqual([]);
    expect(parseTeethInput("   ")).toEqual([]);
  });
});

describe("medicineSummary", () => {
  it("joins only the parts that exist", () => {
    expect(
      medicineSummary({
        name: "Amoxicillin",
        dosage: "500mg",
        frequency: "TID",
        durationDays: 5,
        instructions: null,
      }),
    ).toBe("Amoxicillin · 500mg · TID · 5 days");
    expect(
      medicineSummary({
        name: "Amoxicillin",
        dosage: null,
        frequency: null,
        durationDays: null,
        instructions: null,
      }),
    ).toBe("Amoxicillin");
  });
});

describe("previewLines", () => {
  it("shows what will actually be saved, from the edited data", () => {
    const lines = previewLines({
      ...base,
      estimatedCostPaise: 300_000,
      notes: "No hot food",
    });
    const byLabel = Object.fromEntries(lines.map((l) => [l.label, l.value]));
    expect(byLabel.Procedure).toBe("RCT · Tooth 36 · Sitting 2 of 3");
    expect(byLabel.Fee).toBe("₹3,000");
    expect(byLabel.Notes).toBe("No hot food");
  });

  it("renders an empty extraction as dashes rather than blanks", () => {
    const byLabel = Object.fromEntries(
      previewLines({
        ...base,
        procedure: null,
        teeth: [],
        sittingCurrent: null,
      }).map((l) => [l.label, l.value]),
    );
    expect(byLabel.Procedure).toBe("—");
    expect(byLabel.Prescription).toBe("—");
    expect(byLabel["Follow-up"]).toBe("—");
    expect(byLabel.Fee).toBe("—");
    expect(byLabel.Notes).toBe("—");
  });

  it("lists every prescription — the preview must not truncate what commits", () => {
    const value = previewLines({
      ...base,
      prescriptions: [
        {
          name: "Amoxicillin",
          dosage: "500mg",
          frequency: "TID",
          durationDays: 5,
          instructions: null,
        },
        {
          name: "Ibuprofen",
          dosage: "400mg",
          frequency: "BD",
          durationDays: 3,
          instructions: null,
        },
      ],
    }).find((l) => l.label === "Prescription")!.value;
    expect(value).toBe(
      "Amoxicillin 500mg TID 5 days; Ibuprofen 400mg BD 3 days",
    );
  });
});
