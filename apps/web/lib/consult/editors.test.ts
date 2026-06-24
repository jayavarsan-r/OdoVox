import { describe, expect, it } from 'vitest';
import { ClinicalExtraction } from '@odovox/types';
import {
  addMedicine,
  removeMedicine,
  setFollowUp,
  setProcedure,
  setSittings,
  setStatus,
  setTeeth,
  toPatchBody,
  updateMedicine,
} from './editors.js';

const base = () =>
  ClinicalExtraction.parse({
    procedure: 'RCT',
    teeth: [26],
    sittingCurrent: 3,
    sittingTotal: 4,
    status: 'COMPLETED',
    prescriptions: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 }],
  });

describe('per-field editors → PATCH body', () => {
  it('setProcedure replaces only the procedure', () => {
    const next = setProcedure(base(), 'Scaling');
    expect(next.procedure).toBe('Scaling');
    expect(next.teeth).toEqual([26]); // untouched
  });

  it('setTeeth replaces the teeth array (immutably)', () => {
    const data = base();
    const next = setTeeth(data, [11, 21]);
    expect(next.teeth).toEqual([11, 21]);
    expect(data.teeth).toEqual([26]); // original not mutated
  });

  it('setSittings sets current/total', () => {
    const next = setSittings(base(), 2, 6);
    expect(next.sittingCurrent).toBe(2);
    expect(next.sittingTotal).toBe(6);
  });

  it('setStatus sets the status', () => {
    expect(setStatus(base(), 'IN_PROGRESS').status).toBe('IN_PROGRESS');
  });

  it('setFollowUp builds the follow-up object (and null clears it)', () => {
    expect(setFollowUp(base(), 7, 'Crown').followUp).toEqual({ afterDays: 7, procedureHint: 'Crown' });
    expect(setFollowUp(base(), null, null).followUp).toBeNull();
  });

  it('addMedicine appends; updateMedicine replaces; removeMedicine drops', () => {
    const added = addMedicine(base(), { name: 'Ibuprofen', dosage: '400mg', frequency: 'BD', durationDays: 3, instructions: null });
    expect(added.prescriptions).toHaveLength(2);
    expect(added.prescriptions[1]!.name).toBe('Ibuprofen');

    const updated = updateMedicine(base(), 0, { name: 'Amoxicillin', dosage: '625mg', frequency: 'BD', durationDays: 7, instructions: null });
    expect(updated.prescriptions[0]!.dosage).toBe('625mg');

    const removed = removeMedicine(base(), 0);
    expect(removed.prescriptions).toHaveLength(0);
  });

  it('toPatchBody wraps the data under structuredData', () => {
    const body = toPatchBody(base());
    expect(body).toHaveProperty('structuredData');
    expect(body.structuredData.procedure).toBe('RCT');
  });
});
