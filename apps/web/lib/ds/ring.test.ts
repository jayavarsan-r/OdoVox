import { describe, expect, it } from "vitest";
import { circumference, ringDashArray } from "./ring";

const R = 22; // the spec's Home-hero ring radius
const C = circumference(R);

describe("ringDashArray", () => {
  it("splits the circumference proportionally", () => {
    const { dash, gap } = ringDashArray(2, 3, R);
    expect(dash).toBeCloseTo((2 / 3) * C, 5);
    expect(dash + gap).toBeCloseTo(C, 5);
  });

  it("draws nothing at zero and everything at full", () => {
    expect(ringDashArray(0, 3, R).dash).toBe(0);
    expect(ringDashArray(3, 3, R).dash).toBeCloseTo(C, 5);
  });

  it("clamps overflow instead of drawing past full", () => {
    // A miscount must not render a longer-than-full ring — that reads as a bug
    // in the data, not in the UI, and is hard to spot.
    expect(ringDashArray(9, 3, R).dash).toBeCloseTo(C, 5);
  });

  it("clamps negatives instead of drawing a negative dash", () => {
    expect(ringDashArray(-4, 3, R).dash).toBe(0);
  });

  it("returns an empty ring rather than dividing by zero", () => {
    expect(ringDashArray(1, 0, R)).toEqual({ dash: 0, gap: C });
    expect(ringDashArray(1, Number.NaN, R)).toEqual({ dash: 0, gap: C });
  });
});
