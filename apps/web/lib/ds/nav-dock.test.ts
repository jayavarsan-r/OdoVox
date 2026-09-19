import { describe, expect, it } from "vitest";
import { orbAction } from "./nav-dock";

describe("orbAction — doctor", () => {
  it("is a mic on every screen", () => {
    for (const path of [
      "/home",
      "/patients",
      "/schedule",
      "/more",
      "/consult",
    ]) {
      expect(orbAction("DOCTOR", path).icon).toBe("mic");
    }
  });

  it("always lands on Consult", () => {
    expect(orbAction("DOCTOR", "/home").href).toBe("/consult");
    expect(orbAction("DOCTOR", "/patients").href).toBe("/consult");
  });

  it("carries the extra ring only on its own tab", () => {
    expect(orbAction("DOCTOR", "/consult").highlighted).toBe(true);
    expect(orbAction("DOCTOR", "/consult/abc123").highlighted).toBe(true);
    expect(orbAction("DOCTOR", "/home").highlighted).toBe(false);
  });

  it("names what a TAP does, not what the control is", () => {
    // "Microphone" would tell a screen-reader user nothing about the outcome.
    expect(orbAction("DOCTOR", "/consult").label).toMatch(/record/i);
    expect(orbAction("DOCTOR", "/home").label).toMatch(/consult/i);
  });
});

describe("orbAction — receptionist", () => {
  it("is a plus, because reception's core act is adding, not dictating", () => {
    expect(orbAction("RECEPTIONIST", "/today").icon).toBe("plus");
    expect(orbAction("RECEPTIONIST", "/patients").icon).toBe("plus");
  });

  it("never shows the on-its-own-tab ring — it creates rather than navigating", () => {
    expect(orbAction("RECEPTIONIST", "/today").highlighted).toBe(false);
  });
});

describe("orbAction — admin", () => {
  it("follows the doctor shape (admins hold the clinical role)", () => {
    expect(orbAction("ADMIN", "/home").icon).toBe("mic");
  });
});
