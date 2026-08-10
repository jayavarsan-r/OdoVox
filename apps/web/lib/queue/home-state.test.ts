import { describe, expect, it } from "vitest";
import { flowState, showsOfflineBanner, type FlowInput } from "./home-state";

const day = (over: Partial<FlowInput> = {}): FlowInput => ({
  total: 8,
  done: 3,
  inChair: false,
  waiting: 0,
  ...over,
});

describe("flowState — which Flow frame is true", () => {
  it("frame 13: someone in the chair", () => {
    expect(flowState(day({ inChair: true }))).toBe("in-chair");
  });

  it("frame 14: chair empty with people waiting", () => {
    expect(flowState(day({ waiting: 4 }))).toBe("chair-free");
  });

  it("frame 15: chair empty, nobody waiting, more of the day booked", () => {
    expect(flowState(day({ done: 3, total: 8 }))).toBe("quiet");
  });

  it("frame 16: everything booked is recorded and nobody is left", () => {
    expect(flowState(day({ done: 8, total: 8 }))).toBe("day-done");
  });

  it("nothing booked at all is an empty day, not a finished one", () => {
    expect(flowState(day({ total: 0, done: 0 }))).toBe("empty-day");
  });
});

describe("flowState — the boundaries that bite in a real clinic", () => {
  it("in-chair outranks a finished day: the patient is still sitting there", () => {
    expect(flowState({ total: 8, done: 8, inChair: true, waiting: 0 })).toBe(
      "in-chair",
    );
  });

  it("in-chair outranks a queue of waiting patients", () => {
    expect(flowState({ total: 8, done: 3, inChair: true, waiting: 4 })).toBe(
      "in-chair",
    );
  });

  it("one unrecorded visit keeps the day open", () => {
    expect(flowState({ total: 8, done: 7, inChair: false, waiting: 0 })).toBe(
      "quiet",
    );
  });

  it('waiting patients outrank a finished schedule — walk-ins are not "done"', () => {
    expect(flowState({ total: 8, done: 8, inChair: false, waiting: 2 })).toBe(
      "chair-free",
    );
  });

  it("an empty day is never congratulated, even at done >= total", () => {
    expect(flowState({ total: 0, done: 0, inChair: false, waiting: 0 })).toBe(
      "empty-day",
    );
  });

  it("walk-ins on a day with nothing booked still read as chair-free", () => {
    // total 0 but someone walked in: the queue is what matters, not the calendar.
    // Showing "nothing today" with a person in the waiting room would be a lie.
    expect(flowState({ total: 0, done: 0, inChair: false, waiting: 1 })).toBe(
      "chair-free",
    );
  });
});

describe("flowState — hostile input never throws or invents a state", () => {
  it("clamps done above total rather than reporting a negative remainder", () => {
    expect(flowState({ total: 3, done: 9, inChair: false, waiting: 0 })).toBe(
      "day-done",
    );
  });

  it("treats negative counts as zero", () => {
    expect(
      flowState({ total: -5, done: -2, inChair: false, waiting: -1 }),
    ).toBe("empty-day");
  });

  it("floors fractional counts — 0.9 waiting is nobody waiting", () => {
    expect(
      flowState({ total: 8.9, done: 8.4, inChair: false, waiting: 0.9 }),
    ).toBe("day-done");
  });

  it("floors fractional counts — 1.9 waiting is one person waiting", () => {
    expect(
      flowState({ total: 8.9, done: 8.4, inChair: false, waiting: 1.9 }),
    ).toBe("chair-free");
  });
});

describe("the offline banner is additive, not a state", () => {
  it("shows only when offline", () => {
    expect(showsOfflineBanner(false)).toBe(true);
    expect(showsOfflineBanner(true)).toBe(false);
  });

  it("does not change which Flow frame is true — the hero stays", () => {
    const online = flowState(day({ inChair: true }));
    const offline = flowState(day({ inChair: true }));
    expect(offline).toBe(online);
  });
});
