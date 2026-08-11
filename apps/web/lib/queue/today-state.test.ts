import { describe, expect, it } from "vitest";
import { VisitStatus } from "@odovox/types";
import {
  isWalkIn,
  needsAttention,
  receptionDayState,
  receptionRowState,
  type DayInput,
  type ReceptionRowState,
} from "./today-state";

describe("the nine states reception actually works in", () => {
  it("appointment booked", () => {
    expect(receptionRowState("SCHEDULED")).toBe("booked");
  });

  it("patient arrived", () => {
    expect(receptionRowState("CHECKED_IN")).toBe("arrived");
  });

  it("patient waiting", () => {
    expect(receptionRowState("WAITING")).toBe("waiting");
  });

  it("patient in chair", () => {
    expect(receptionRowState("IN_CHAIR")).toBe("in-chair");
  });

  it("patient sent to checkout", () => {
    expect(receptionRowState("CHECKOUT")).toBe("checkout");
  });

  it("patient completed", () => {
    expect(receptionRowState("COMPLETED")).toBe("completed");
  });

  it("no-show", () => {
    expect(receptionRowState("NO_SHOW")).toBe("no-show");
  });

  it("cancelled", () => {
    expect(receptionRowState("CANCELLED")).toBe("cancelled");
  });

  it("walk-in is an ORIGIN, not a status — it coexists with every row state", () => {
    // A walk-in can be waiting, in the chair, or at checkout. Modelling it as a ninth
    // mutually-exclusive status would have made "walk-in" and "in chair" contradictory.
    expect(isWalkIn(null)).toBe(true);
    expect(isWalkIn(undefined)).toBe(true);
    expect(isWalkIn("appt_123")).toBe(false);
    expect(receptionRowState("IN_CHAIR")).toBe("in-chair");
  });

  it("maps EVERY VisitStatus — a new status cannot slip through unhandled", () => {
    for (const status of VisitStatus.options) {
      expect(() => receptionRowState(status)).not.toThrow();
      expect(receptionRowState(status)).toBeTruthy();
    }
  });
});

describe("which rows reception still has to act on", () => {
  const needs: ReceptionRowState[] = [
    "arrived",
    "waiting",
    "checkout",
    "no-show",
  ];
  const done: ReceptionRowState[] = [
    "booked",
    "in-chair",
    "completed",
    "cancelled",
  ];

  it.each(needs)("%s needs the front desk", (s) => {
    expect(needsAttention(s)).toBe(true);
  });

  it.each(done)("%s does not", (s) => {
    expect(needsAttention(s)).toBe(false);
  });

  it("in-chair is the doctor’s move, not reception’s", () => {
    expect(needsAttention("in-chair")).toBe(false);
  });

  it("a no-show still needs someone — it is a call to make, not a closed row", () => {
    expect(needsAttention("no-show")).toBe(true);
  });
});

describe("the day as a whole", () => {
  const day = (over: Partial<DayInput> = {}): DayInput => ({
    total: 8,
    completed: 3,
    openRows: 5,
    ...over,
  });

  it("empty day: nothing booked, nobody here", () => {
    expect(receptionDayState({ total: 0, completed: 0, openRows: 0 })).toBe(
      "empty-day",
    );
  });

  it("day completed: everything booked resolved and nobody left", () => {
    expect(receptionDayState({ total: 8, completed: 8, openRows: 0 })).toBe(
      "day-done",
    );
  });

  it("active while anyone is still open", () => {
    expect(receptionDayState(day())).toBe("active");
  });

  it("ONE person waiting outranks an otherwise finished day", () => {
    // The failure that matters: telling reception "that's everyone" while somebody is
    // sitting in the waiting room.
    expect(receptionDayState({ total: 8, completed: 7, openRows: 1 })).toBe(
      "active",
    );
  });

  it("a walk-in on a day with nothing booked keeps the day active", () => {
    expect(receptionDayState({ total: 1, completed: 0, openRows: 1 })).toBe(
      "active",
    );
  });

  it("an empty day is never congratulated for finishing", () => {
    expect(receptionDayState({ total: 0, completed: 0, openRows: 0 })).not.toBe(
      "day-done",
    );
  });

  it("no-shows do not close the day on their own", () => {
    // 8 booked, 5 completed, 3 no-shows still needing a call: openRows carries them.
    expect(receptionDayState({ total: 8, completed: 5, openRows: 3 })).toBe(
      "active",
    );
  });

  it("clamps hostile counts instead of inventing a state", () => {
    expect(receptionDayState({ total: -4, completed: -1, openRows: -2 })).toBe(
      "empty-day",
    );
    expect(
      receptionDayState({ total: 8.9, completed: 8.4, openRows: 0.9 }),
    ).toBe("day-done");
  });
});
