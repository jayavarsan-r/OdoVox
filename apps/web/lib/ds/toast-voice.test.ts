import { describe, expect, it } from "vitest";
import {
  SUCCESS_MS,
  UNDO_MS,
  requiresAction,
  toastDuration,
} from "./toast-voice";

describe("toastDuration", () => {
  it("auto-dismisses a plain success after 4s (frame 79)", () => {
    expect(toastDuration("success")).toBe(SUCCESS_MS);
  });

  it("holds a success carrying Undo for the full undo window", () => {
    // An undo the user cannot reach is not an undo — 4s would expire the toast
    // before the 6s reversal window it advertises.
    expect(toastDuration("success", true)).toBe(UNDO_MS);
    expect(UNDO_MS).toBeGreaterThan(SUCCESS_MS);
  });

  it("never auto-dismisses a problem", () => {
    // A failure that vanishes on its own is a failure nobody fixed.
    expect(toastDuration("problem")).toBe(Infinity);
    expect(toastDuration("problem", true)).toBe(Infinity);
  });

  it("never auto-dismisses the offline state", () => {
    expect(toastDuration("offline")).toBe(Infinity);
  });
});

describe("requiresAction", () => {
  it("is true only for problem", () => {
    expect(requiresAction("problem")).toBe(true);
    expect(requiresAction("success")).toBe(false);
    expect(requiresAction("offline")).toBe(false);
  });
});
