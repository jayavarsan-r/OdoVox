import { describe, expect, it } from "vitest";
import type { ClinicalExtraction } from "@odovox/types";
import {
  bentoTiles,
  invalidFields,
  medicineSummary,
  medicinesState,
  nextSittingLine,
  parseTeethInput,
  previewLines,
  proseSections,
  reviewSubtitle,
  savedOutcomes,
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

describe('bentoTiles', () => {
  it('labels one tooth singular and several plural', () => {
    expect(bentoTiles(base).teeth.label).toBe('TOOTH');
    expect(bentoTiles({ ...base, teeth: [11, 21] }).teeth.label).toBe('TEETH');
  });

  it('sets multiple teeth as a pair of numerals, not a comma list', () => {
    expect(bentoTiles({ ...base, teeth: [11, 21] }).teeth.value).toBe('11 · 21');
  });

  it('breaks the fee down per tooth so the arithmetic is checkable', () => {
    const fees = bentoTiles({ ...base, teeth: [11, 21], estimatedCostPaise: 900_000 }).fees;
    expect(fees.value).toBe('₹9,000');
    expect(fees.caption).toBe('₹4,500 × 2');
  });

  it('does not invent a breakdown for a single tooth', () => {
    expect(bentoTiles({ ...base, estimatedCostPaise: 300_000 }).fees.caption).toBeUndefined();
  });

  it('shows a dash rather than ₹0 when no fee was dictated', () => {
    // ₹0 would read as "this was free", which is a different clinical and billing claim
    // from "nobody said". The extractor never invents a cost, so neither does the tile.
    expect(bentoTiles(base).fees.value).toBe('—');
  });
});

describe('medicinesState', () => {
  it('counts only unresolved conflicts', () => {
    expect(medicinesState([warn({ resolved: false })])).toEqual({ text: '1 conflict', tone: 'crit' });
    expect(medicinesState([warn({ resolved: false }), warn({ resolved: false })]).text).toBe('2 conflicts');
  });

  it('distinguishes "I resolved that" from "there was never anything"', () => {
    expect(medicinesState([warn({ resolved: true })])).toEqual({ text: '✓ checked', tone: 'live' });
    expect(medicinesState([])).toEqual({ text: '✓ no conflicts', tone: 'live' });
  });
});

describe('proseSections', () => {
  it('renders dictated advice as the instructions section', () => {
    expect(proseSections({ ...base, notes: 'No hot food' })).toEqual([
      { label: 'INSTRUCTIONS', body: 'No hot food' },
    ]);
  });

  it('omits a section rather than showing an empty one', () => {
    expect(proseSections(base)).toEqual([]);
    expect(proseSections({ ...base, notes: '   ' })).toEqual([]);
  });
});

describe('reviewSubtitle', () => {
  it('reads as the chart line a dentist would write', () => {
    expect(reviewSubtitle(base)).toBe('RCT 36 · Sitting 2');
  });

  it('degrades without inventing punctuation', () => {
    expect(reviewSubtitle({ ...base, procedure: null, sittingCurrent: null })).toBe('');
  });
});

describe('nextSittingLine', () => {
  const from = new Date('2026-07-09T04:00:00Z'); // Thu 9 Jul, IST

  it('resolves the relative follow-up to a real date', () => {
    const line = nextSittingLine(
      { ...base, followUp: { afterDays: 7, procedureHint: 'obturation' } },
      from,
    );
    expect(line).toBe('Thu, 16 Jul · obturation');
  });

  it('never invents a time — no slot has been booked yet at review', () => {
    const line = nextSittingLine({ ...base, followUp: { afterDays: 7, procedureHint: null } }, from);
    expect(line).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('is absent when no follow-up was dictated', () => {
    expect(nextSittingLine(base, from)).toBeNull();
    expect(nextSittingLine({ ...base, followUp: { afterDays: null, procedureHint: 'x' } }, from)).toBeNull();
  });
});

describe('savedOutcomes', () => {
  const from = new Date('2026-07-09T04:00:00Z');

  it('claims only what actually happened', () => {
    expect(savedOutcomes(base, from)).toEqual([]);
  });

  it('lists the prescription, the bill and the booking when each exists', () => {
    expect(
      savedOutcomes(
        {
          ...base,
          prescriptions: [
            { name: 'Amoxicillin', dosage: null, frequency: null, durationDays: null, instructions: null },
          ],
          estimatedCostPaise: 300_000,
          followUp: { afterDays: 7, procedureHint: null },
        },
        from,
      ),
    ).toEqual([
      { text: '✓ Rx PDF ready', tone: 'live' },
      { text: '₹3,000 → checkout', tone: 'lime' },
      { text: 'Thu, 16 Jul booked', tone: 'sky' },
    ]);
  });
});
