import { describe, expect, it } from "vitest";
import { initialsOf, ringForQueueState } from "./avatar";

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Anand Kumar")).toBe("AK");
    expect(initialsOf("Lakshmi Narayanan")).toBe("LN");
  });

  it("skips honorifics so the initials name the person", () => {
    // "Dr. Priya Raghavan" must read PR, not DP.
    expect(initialsOf("Dr. Priya Raghavan")).toBe("PR");
    expect(initialsOf("Dr Asha Menon")).toBe("AM");
  });

  it("uses the first two letters of a single-word name", () => {
    expect(initialsOf("Rajasimhan")).toBe("RA");
  });

  it("ignores extra whitespace", () => {
    expect(initialsOf("  Meena   Iyer  ")).toBe("MI");
  });

  it("never returns empty — an empty circle reads as a stuck loading state", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});

describe("ringForQueueState", () => {
  it("maps in-chair to the live ring", () => {
    expect(ringForQueueState("IN_CHAIR")).toBe("live");
  });

  it("maps waiting and booked states to the sky ring", () => {
    expect(ringForQueueState("WAITING")).toBe("sky");
    expect(ringForQueueState("SCHEDULED")).toBe("sky");
    expect(ringForQueueState("CHECKED_IN")).toBe("sky");
  });

  it("falls back to the neutral ring", () => {
    expect(ringForQueueState("COMPLETED")).toBe("none");
    expect(ringForQueueState(null)).toBe("none");
    expect(ringForQueueState(undefined)).toBe("none");
  });
});
