import { describe, expect, it } from 'vitest';
import { ClinicalExtraction } from '@odovox/types';
import { buildSafetyView, hasUnresolvedBlocking } from './safety-view.js';

const withRx = (name: string) =>
  ClinicalExtraction.parse({
    procedure: 'RCT',
    teeth: [26],
    prescriptions: [{ name, dosage: '500mg', frequency: 'TID', durationDays: 5 }],
  });

describe('buildSafetyView', () => {
  it('marks an allergy warning ACTIVE while the offending medicine is still prescribed', () => {
    const data = withRx('Amoxicillin');
    const view = buildSafetyView(
      { warnings: [{ code: 'allergy_conflict', detail: 'Amoxicillin', field: 'prescriptions', message: 'Allergy conflict: Amoxicillin' }], blockingErrors: [] },
      data,
    );
    expect(view).toHaveLength(1);
    expect(view[0]!.resolved).toBe(false);
    expect(view[0]!.blocking).toBe(false);
  });

  it('marks the warning RESOLVED (not gone) once the doctor removes that medicine', () => {
    const data = withRx('Paracetamol'); // Amoxicillin removed/replaced
    const view = buildSafetyView(
      { warnings: [{ code: 'allergy_conflict', detail: 'Amoxicillin', field: 'prescriptions', message: 'Allergy conflict: Amoxicillin' }], blockingErrors: [] },
      data,
    );
    expect(view).toHaveLength(1); // still rendered
    expect(view[0]!.resolved).toBe(true);
  });

  it('flags an invalid-tooth blocking error and clears it when the tooth is corrected', () => {
    const bad = ClinicalExtraction.parse({ teeth: [19] });
    const blockingItem = { code: 'invalid_tooth', detail: '19', field: 'teeth', message: 'Tooth 19 invalid' };
    const activeView = buildSafetyView({ warnings: [], blockingErrors: [blockingItem] }, bad);
    expect(activeView[0]!.blocking).toBe(true);
    expect(activeView[0]!.resolved).toBe(false);
    expect(hasUnresolvedBlocking(activeView)).toBe(true);

    const fixed = ClinicalExtraction.parse({ teeth: [18] });
    const fixedView = buildSafetyView({ warnings: [], blockingErrors: [blockingItem] }, fixed);
    expect(fixedView[0]!.resolved).toBe(true);
    expect(hasUnresolvedBlocking(fixedView)).toBe(false);
  });

  it('resolves a sitting overflow once current no longer exceeds total', () => {
    const overflow = ClinicalExtraction.parse({ sittingCurrent: 3, sittingTotal: 2 });
    const item = { code: 'sitting_overflow', field: 'sittings', message: 'Sitting overflow' };
    expect(buildSafetyView({ warnings: [item], blockingErrors: [] }, overflow)[0]!.resolved).toBe(false);
    const fixed = ClinicalExtraction.parse({ sittingCurrent: 2, sittingTotal: 4 });
    expect(buildSafetyView({ warnings: [item], blockingErrors: [] }, fixed)[0]!.resolved).toBe(true);
  });
});
