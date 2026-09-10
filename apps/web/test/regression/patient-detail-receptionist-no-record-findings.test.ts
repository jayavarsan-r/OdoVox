import { describe, expect, it } from 'vitest';
import { readScreen } from './read-screen';

/**
 * Phase 9.6 Issue 14: receptionists must never see the "Record findings" surface — dictating
 * clinical findings is a doctor act (regulatory). The server already 403s POST /consultations for
 * receptionists (create-consultation-rbac-doctor-only.test.ts in apps/api); this pins the client
 * half so the card can't silently reappear for the wrong role.
 */

// The whole patient screen, not just page.tsx — it was split into co-located tab and
// sheet files (Task 21) and these invariants are about the screen, not the file.
const page = readScreen('app', '(app)', 'patients', '[id]');

describe('patient detail — record findings is role-gated', () => {
  it('derives a doctor-only flag from the active membership role', () => {
    expect(page).toMatch(/useAuth\(\(s\) => s\.activeMembership\?\.role\)/);
    expect(page).toMatch(/canRecordFindings = role === 'DOCTOR' \|\| role === 'ADMIN'/);
  });

  it('renders the "Record findings" action only behind the doctor gate', () => {
    // Frame 37 (ruling B2) turned the dark HeroCard into the action row's primary CTA.
    // The GATE is what this protects, not the widget.
    //
    // Matched as a gate-then-control PAIR rather than by finding the first occurrence of
    // the phrase: the empty state on the Cases tab says "Tap Record findings…" as prose,
    // and searching for the words alone lands there and reports a gate that is missing
    // from a sentence that never had one.
    expect(page).toMatch(/canRecordFindings \? \(\s*<Button[\s\S]{0,240}?Record findings/);
  });

  it('gates the "Continue treatment" recorder button the same way', () => {
    // Pair-matched like the CTA above rather than by a fixed character window: frame 37's
    // active-case card sits between the gate and the button, and a proximity window
    // reports a missing gate whenever anything is added in between.
    expect(page).toMatch(/canRecordFindings \? \(\s*<Button[\s\S]{0,300}?Continue treatment/);
  });
});
