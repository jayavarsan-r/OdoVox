import { describe, expect, it } from "vitest";
import { dayCaption, dayShape, type DayAppointment } from "./day-river-view";

const appt = (
  status: DayAppointment["status"],
  patientId?: string,
): DayAppointment => ({
  status,
  patientId: patientId ?? null,
});

describe("dayShape", () => {
  it("counts one segment per live appointment", () => {
    const s = dayShape(
      [appt("COMPLETED"), appt("SCHEDULED"), appt("SCHEDULED")],
      null,
    );
    expect(s).toEqual({ total: 3, done: 1, currentIndex: null });
  });

  it("drops cancelled and no-show appointments from the day", () => {
    // Drawing a cancelled slot as "ahead" tells a doctor with a clear afternoon that they
    // still have patients waiting.
    const s = dayShape(
      [
        appt("COMPLETED"),
        appt("CANCELLED"),
        appt("NO_SHOW"),
        appt("SCHEDULED"),
      ],
      null,
    );
    expect(s.total).toBe(2);
    expect(s.done).toBe(1);
  });

  it("locates the patient in the chair among the live appointments", () => {
    const s = dayShape(
      [
        appt("COMPLETED", "p1"),
        appt("CHECKED_IN", "p2"),
        appt("SCHEDULED", "p3"),
      ],
      "p2",
    );
    expect(s.currentIndex).toBe(1);
  });

  it("indexes against the FILTERED list, not the raw one", () => {
    // A cancelled appointment earlier in the day would otherwise shift the dark segment
    // onto the wrong patient.
    const s = dayShape(
      [
        appt("CANCELLED", "p0"),
        appt("COMPLETED", "p1"),
        appt("CHECKED_IN", "p2"),
      ],
      "p2",
    );
    expect(s.currentIndex).toBe(1);
  });

  it("reports no current segment for a walk-in with no appointment", () => {
    const s = dayShape([appt("SCHEDULED", "p1")], "walkin-patient");
    expect(s.currentIndex).toBeNull();
  });

  it("handles an empty day", () => {
    expect(dayShape([], null)).toEqual({
      total: 0,
      done: 0,
      currentIndex: null,
    });
  });
});

describe("dayCaption", () => {
  it("reads as frame 13 sets it", () => {
    const shape = { total: 8, done: 3, currentIndex: 3 };
    expect(dayCaption(shape, "Anand", 795_000).text).toBe(
      "3 seen · Anand in the chair · 4 to go · ₹7,950 in",
    );
  });

  it("does not count the patient in the chair as still to go", () => {
    const shape = { total: 2, done: 1, currentIndex: 1 };
    expect(dayCaption(shape, "Anand", null).text).toBe(
      "1 seen · Anand in the chair",
    );
  });

  it("drops clauses that would read as bad news rather than no news", () => {
    // "0 seen · 0 to go · ₹0 in" at 9am describes a disaster. It is just early.
    expect(
      dayCaption({ total: 4, done: 0, currentIndex: null }, null, 0).text,
    ).toBe("4 to go");
  });

  it("says nothing at all on an empty day", () => {
    expect(
      dayCaption({ total: 0, done: 0, currentIndex: null }, null, null).text,
    ).toBe("");
  });

  it("never reports negative remaining work", () => {
    // Defensive: a double-confirm could push done past total.
    const shape = { total: 2, done: 5, currentIndex: null };
    expect(dayCaption(shape, null, null).text).not.toContain("-");
  });
});
