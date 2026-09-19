import { describe, expect, it } from "vitest";
import { canAccess, tabsForRole, landingRoute } from "./rbac";

describe("rbac", () => {
  /**
   * Repointed in Phase 10 Task 5 for the v9 nav: FOUR tabs plus the orb.
   * Lab, Clinic and Billing moved into /more (frame 70).
   */
  it("gives doctors and receptionists different 4-tab sets", () => {
    const doc = tabsForRole("DOCTOR").map((t) => t.href);
    const rec = tabsForRole("RECEPTIONIST").map((t) => t.href);
    expect(doc).toContain("/home");
    expect(doc).not.toContain("/today");
    expect(rec).toContain("/today");
    expect(rec).not.toContain("/home");
    expect(doc).toHaveLength(4);
    expect(rec).toHaveLength(4);
    // Both roles reach everything else through the hub.
    expect(doc).toContain("/more");
    expect(rec).toContain("/more");
  });

  it("keeps /billing reachable for reception even though it lost its tab", () => {
    // Global Constraint 1: a route never disappears. Losing a TAB is not losing access.
    expect(canAccess("/billing", "RECEPTIONIST")).toBe(true);
    expect(canAccess("/lab", "DOCTOR")).toBe(true);
    expect(canAccess("/clinic", "DOCTOR")).toBe(true);
  });

  it("lets both roles open the /more hub", () => {
    expect(canAccess("/more", "DOCTOR")).toBe(true);
    expect(canAccess("/more", "RECEPTIONIST")).toBe(true);
  });

  it("lands each role on the right home", () => {
    expect(landingRoute("DOCTOR")).toBe("/home");
    expect(landingRoute("RECEPTIONIST")).toBe("/today");
  });

  it("blocks receptionist from /home and doctor from /today and /billing", () => {
    expect(canAccess("/home", "RECEPTIONIST")).toBe(false);
    expect(canAccess("/today", "DOCTOR")).toBe(false);
    expect(canAccess("/billing", "DOCTOR")).toBe(false);
  });

  it("shares patients/schedule/lab across roles (incl. nested patient routes)", () => {
    expect(canAccess("/patients", "RECEPTIONIST")).toBe(true);
    expect(canAccess("/patients/abc123", "RECEPTIONIST")).toBe(true);
    expect(canAccess("/schedule", "DOCTOR")).toBe(true);
    expect(canAccess("/lab", "RECEPTIONIST")).toBe(true);
  });
});
