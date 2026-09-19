import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Regression (Phase 9.5 P1.2, Issue 7): the consult screen rendered the patient's name twice —
 * once in the page header ("Fatima Sheikh · 45 yrs · LIVE") and again in the context card body —
 * and the card sections were cramped. Per Phase 4.5 §4.1: header is back button + "Consultation";
 * the avatar + name live ONLY in the card, name at 24px semibold, sub-line one row
 * (age · gender · code · token), sections separated by 24px.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(join(webRoot, 'app', '(app)', 'consult', '[id]', 'page.tsx'), 'utf8');
const card = readFileSync(join(webRoot, 'components', 'consult', 'patient-context-card.tsx'), 'utf8');

describe('consult context card — no duplicate name', () => {
  it('the generic header is a static title, never the patient name', () => {
    expect(page).toMatch(/>Consultation</);
  });

  it('the card is the single place rendering the patient name', () => {
    expect(card).toMatch(/patient\.name/);
  });

  it('exactly one identity surface is mounted per consult state', () => {
    // The original rule was "the name renders once", enforced by banning the identifier
    // from the page. That stopped working once the page legitimately grew two more
    // identity surfaces — frames 23-26's recording strip, and the name PASSED (not
    // rendered) to frame 27's verification header. Banning the identifier would now
    // forbid correct code, so the rule is enforced where it actually lives: the three
    // surfaces' conditions must be mutually exclusive.
    //
    //   idle / ready        → PatientContextCard
    //   recording…failed    → the page's own patient strip
    //   verify              → the verification card's header, and nothing else
    expect(page).toMatch(/const showsPatientStrip = recording \|\| isPipeline \|\| failed;/);
    expect(page).toMatch(/\{context && isRecorder && !recording \?/);
    expect(page).not.toMatch(/isVerify[\s\S]{0,80}<PatientContextCard/);
  });
});

describe('consult context card — hierarchy and spacing', () => {
  it('renders name at display size (24px semibold)', () => {
    expect(card).toMatch(/text-2xl font-semibold/);
  });

  it('token sits on the identity sub-line, not a third row', () => {
    // one sub-line: age · gender · code · token
    expect(card).toMatch(/genderLabel\(patient\.gender\)[\s\S]{0,220}Token \{visit\.tokenNumber\}/);
  });

  it('sections flow avatar → chief complaint → allergy/medical chips → x-rays', () => {
    const identity = card.indexOf('initials(patient.name)');
    const complaint = card.indexOf('Chief complaint');
    const chips = card.indexOf('Allergies (');
    const xrays = card.indexOf('<XrayStrip');
    expect(identity).toBeGreaterThan(-1);
    expect(complaint).toBeGreaterThan(identity);
    expect(chips).toBeGreaterThan(complaint);
    expect(xrays).toBeGreaterThan(chips);
  });

  it('uses 24px section gaps (§4.1), not cramped 16px', () => {
    expect(card).toMatch(/my-6 border-t/);
    expect(card).toMatch(/mt-6 grid/);
  });
});
