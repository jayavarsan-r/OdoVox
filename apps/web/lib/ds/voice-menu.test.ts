import { describe, expect, it } from "vitest";
import { voiceMenuRows } from "./voice-menu";

describe("voiceMenuRows — the no-accidental-recording rule", () => {
  it("names the patient it will record", () => {
    const [first] = voiceMenuRows({
      inChairName: "Anand Kumar",
      inChairVisitId: "v1",
    });
    expect(first!.label).toBe("Start consultation");
    expect(first!.sublabel).toContain("Anand Kumar");
    expect(first!.href).toBe("/consult/v1");
    expect(first!.hot).toBe(true);
  });

  it("refuses to offer a recording when nobody is in the chair", () => {
    // The orb's hold works from ANY screen, including ones with no patient context.
    // A bare "Start consultation" here is exactly how a recording lands on the wrong
    // patient — so the row states the situation and routes to the queue instead.
    const [first] = voiceMenuRows({ inChairName: null });
    expect(first!.label).toBe("No one in the chair");
    expect(first!.hot).toBe(false);
    expect(first!.href).toBe("/consult");
  });

  it("treats an empty name as nobody, not as a patient called ''", () => {
    expect(voiceMenuRows({ inChairName: "" })[0]!.hot).toBe(false);
  });

  it("falls back to the queue when the patient has no visit id", () => {
    const [first] = voiceMenuRows({
      inChairName: "Anand Kumar",
      inChairVisitId: null,
    });
    expect(first!.href).toBe("/consult");
  });

  it("offers exactly one hot row, and only when it is safe", () => {
    const withPatient = voiceMenuRows({
      inChairName: "Meena Iyer",
      inChairVisitId: "v2",
    });
    expect(withPatient.filter((r) => r.hot)).toHaveLength(1);
    expect(
      voiceMenuRows({ inChairName: null }).filter((r) => r.hot),
    ).toHaveLength(0);
  });

  it("always offers the five spec intents", () => {
    expect(voiceMenuRows({ inChairName: null }).map((r) => r.id)).toEqual([
      "consultation",
      "new-patient",
      "book",
      "lab-case",
      "find-patient",
    ]);
  });
});
