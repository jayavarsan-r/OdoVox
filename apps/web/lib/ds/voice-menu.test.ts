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

  it("always offers the five spec intents, in the frame's order", () => {
    // Was an exact-equality assertion on the whole list. Ruling #41 adds a sixth row
    // (free-form dictation) and reception gets two more, so equality would now fail for
    // a change that was approved. The GUARANTEE this test exists for is that frame 78's
    // five intents are all present and in order — that is what is asserted now, and it
    // still fails if one is dropped or reordered.
    const ids = voiceMenuRows({ inChairName: null }).map((r) => r.id);
    expect(ids.slice(0, 5)).toEqual([
      "consultation",
      "new-patient",
      "book",
      "lab-case",
      "find-patient",
    ]);
  });
});

describe("the orb as the single global voice affordance (#41)", () => {
  it("always offers free-form dictation — that is what makes it a voice surface", () => {
    const dictate = voiceMenuRows({}).find((r) => r.id === "dictate");
    expect(dictate).toBeDefined();
    // href null: the destination is not known until the sentence is spoken.
    expect(dictate!.href).toBeNull();
  });

  it("offers dictation with or without a patient in the chair", () => {
    for (const ctx of [{}, { inChairName: "Anand", inChairVisitId: "v1" }]) {
      expect(voiceMenuRows(ctx).some((r) => r.id === "dictate")).toBe(true);
    }
  });

  it("dictation is never the hot row — the named consultation outranks it", () => {
    const rows = voiceMenuRows({ inChairName: "Anand", inChairVisitId: "v1" });
    expect(rows.find((r) => r.id === "dictate")!.hot).toBe(false);
    expect(rows.find((r) => r.id === "consultation")!.hot).toBe(true);
  });

  it("gives reception the two rows its floating FAB used to carry", () => {
    const ids = voiceMenuRows({ role: "RECEPTIONIST" }).map((r) => r.id);
    expect(ids).toContain("walk-in");
    expect(ids).toContain("payment");
  });

  it("does not show reception's rows to a doctor", () => {
    const ids = voiceMenuRows({ role: "DOCTOR" }).map((r) => r.id);
    expect(ids).not.toContain("walk-in");
    expect(ids).not.toContain("payment");
  });

  it("every row except dictate still carries a real destination", () => {
    for (const row of voiceMenuRows({ role: "RECEPTIONIST" })) {
      if (row.id === "dictate") continue;
      expect(row.href).toBeTruthy();
    }
  });

  it("the safety rule survives the new rows: row one still names who it records", () => {
    const rows = voiceMenuRows({ role: "RECEPTIONIST" });
    expect(rows[0]!.id).toBe("consultation");
    expect(rows[0]!.label).toBe("No one in the chair");
  });
});
