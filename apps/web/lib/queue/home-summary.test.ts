import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { heroClinicalLine } from "./home-summary.js";

/**
 * Regression (Phase 9.5 P1.1, Issue 2): the doctor Home hero said "Queue is clear" — hardcoded —
 * while patients sat in the queue on /consult. The subtitle must derive from the SAME queue store
 * the consult page reads (hydrated by useQueueSnapshot, kept live by queue.* realtime events).
 */


describe("Home hero wiring", () => {
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const home = readFileSync(
    join(webRoot, "app", "(app)", "home", "page.tsx"),
    "utf8",
  );

  it("no longer hardcodes the subtitle; reads the shared queue store", () => {
    expect(home).not.toMatch(/subtitle="Queue is clear"/);
    // Quote-agnostic: the formatter rewrites '…' to "…", and this assertion is about
    // the wiring, not about which quote character prettier happened to leave behind.
    expect(home).toMatch(/useQueueSnapshot\(['"]me['"]\)/);
    // Was pinned to `consultHeroSubtitle`, which the Flow states superseded and which is
    // now deleted. The guarantee this test exists for is that the hero is DERIVED from the
    // store rather than hardcoded — so it pins the derivation, not one helper's name.
    expect(home).toMatch(/flowState\(/);
    expect(home).toMatch(/heroClinicalLine\(/);
  });
});

describe("heroClinicalLine — frame 13's clinical context", () => {
  const plan = { procedure: 'RCT', teeth: [36], sitting: 2, totalSittings: 3 };

  it('reads procedure, tooth and sitting', () => {
    expect(heroClinicalLine({ activePlan: plan })).toBe('RCT 36 · sitting 2 of 3');
  });

  it('drops the sitting clause for a single-sitting procedure — "1 of 1" is noise', () => {
    expect(heroClinicalLine({ activePlan: { ...plan, sitting: 1, totalSittings: 1 } })).toBe(
      'RCT 36',
    );
  });

  it('omits the tooth cleanly for full-mouth work, never a dangling separator', () => {
    const line = heroClinicalLine({ activePlan: { ...plan, teeth: [] } });
    expect(line).toBe('RCT · sitting 2 of 3');
    expect(line).not.toMatch(/\s{2}|·\s*·/);
  });

  it('lists multiple teeth', () => {
    expect(heroClinicalLine({ activePlan: { ...plan, teeth: [36, 37] } })).toBe(
      'RCT 36, 37 · sitting 2 of 3',
    );
  });

  it('falls back to the complaint when there is no plan — most walk-ins', () => {
    expect(heroClinicalLine({ activePlan: null, chiefComplaint: 'Toothache' })).toBe(
      'Toothache',
    );
  });

  it('never renders empty: no plan and no complaint still says something true', () => {
    expect(heroClinicalLine({ activePlan: null })).toBe('Consultation');
    expect(heroClinicalLine({ activePlan: null, chiefComplaint: null })).toBe('Consultation');
  });

  it('does not carry the allergy — that is rendered separately so clamping cannot hide it', () => {
    expect(heroClinicalLine({ activePlan: plan })).not.toMatch(/allerg/i);
  });
});
