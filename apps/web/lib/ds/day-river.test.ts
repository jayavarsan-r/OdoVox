import { describe, expect, it } from "vitest";
import { dayRiverSegments, isDayComplete } from "./day-river";

describe("dayRiverSegments", () => {
  it("draws one segment per appointment — the river's length IS the day's shape", () => {
    // Not a progress bar: a 3-appointment day and a 12-appointment day must look
    // different at a glance, so nothing normalises to a percentage.
    expect(dayRiverSegments({ total: 3, done: 0 })).toHaveLength(3);
    expect(dayRiverSegments({ total: 12, done: 0 })).toHaveLength(12);
  });

  it("marks done, current and ahead in order (frame 13)", () => {
    expect(dayRiverSegments({ total: 8, done: 3, currentIndex: 3 })).toEqual([
      "done",
      "done",
      "done",
      "current",
      "ahead",
      "ahead",
      "ahead",
      "ahead",
    ]);
  });

  it("shows no current segment when the chair is free", () => {
    const seg = dayRiverSegments({ total: 4, done: 2, currentIndex: null });
    expect(seg).toEqual(["done", "done", "ahead", "ahead"]);
    expect(seg).not.toContain("current");
  });

  it("ignores a currentIndex outside the day instead of throwing", () => {
    // Stale queue state after a reschedule is the realistic cause here.
    expect(dayRiverSegments({ total: 3, done: 1, currentIndex: 9 })).toEqual([
      "done",
      "ahead",
      "ahead",
    ]);
    expect(dayRiverSegments({ total: 3, done: 1, currentIndex: -2 })).toEqual([
      "done",
      "ahead",
      "ahead",
    ]);
  });

  it("clamps done above total so a double-confirm cannot overfill the river", () => {
    expect(dayRiverSegments({ total: 2, done: 7 })).toEqual(["done", "done"]);
  });

  it("keeps the chair visible even if that appointment is already counted done", () => {
    // Where the doctor IS is the more useful truth at a glance.
    expect(dayRiverSegments({ total: 3, done: 3, currentIndex: 1 })).toEqual([
      "done",
      "current",
      "done",
    ]);
  });

  it("renders nothing for an empty day rather than a zero-width bar", () => {
    expect(dayRiverSegments({ total: 0, done: 0 })).toEqual([]);
  });
});

describe("isDayComplete", () => {
  it("is true only when every appointment has a confirmed record", () => {
    expect(isDayComplete({ total: 8, done: 8 })).toBe(true);
    expect(isDayComplete({ total: 8, done: 7 })).toBe(false);
  });

  it("is false for an empty day — nothing was completed", () => {
    expect(isDayComplete({ total: 0, done: 0 })).toBe(false);
  });
});
