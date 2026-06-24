import { describe, expect, it } from 'vitest';
import { hydrateState } from './reducer';
import { getByDoctor, getCheckout, getInChair, getWaiting, waitingCountByDoctor } from './selectors';
import { makeDoctor, makeSnapshot, makeVisit } from '../../test/queue-fixtures';

describe('queue selectors', () => {
  it('getWaiting sorts by priority desc, then check-in time', () => {
    const state = hydrateState(
      makeSnapshot({
        visits: [
          makeVisit({ id: 'a', status: 'WAITING', priority: 0, checkedInAt: new Date('2026-06-24T09:00:00Z') }),
          makeVisit({ id: 'b', status: 'WAITING', priority: 10, checkedInAt: new Date('2026-06-24T09:05:00Z') }),
          makeVisit({ id: 'c', status: 'WAITING', priority: 0, checkedInAt: new Date('2026-06-24T08:55:00Z') }),
        ],
      }),
    );
    expect(getWaiting(state).map((v) => v.id)).toEqual(['b', 'c', 'a']);
  });

  it('getInChair returns the single in-chair visit for a doctor', () => {
    const state = hydrateState(
      makeSnapshot({
        visits: [
          makeVisit({ id: 'a', status: 'WAITING' }),
          makeVisit({ id: 'b', status: 'IN_CHAIR', assignedDoctorId: 'doc-1' }),
        ],
      }),
    );
    expect(getInChair(state, 'doc-1')?.id).toBe('b');
    expect(getInChair(state, 'doc-2')).toBeNull();
  });

  it('getCheckout returns checkout visits only', () => {
    const state = hydrateState(
      makeSnapshot({
        visits: [makeVisit({ id: 'a', status: 'CHECKOUT' }), makeVisit({ id: 'b', status: 'WAITING' })],
      }),
    );
    expect(getCheckout(state).map((v) => v.id)).toEqual(['a']);
  });

  it('getByDoctor groups in-chair + waiting per doctor', () => {
    const state = hydrateState(
      makeSnapshot({
        doctors: [makeDoctor({ id: 'doc-1', name: 'Dr. Asha' }), makeDoctor({ id: 'doc-2', name: 'Dr. Vikram' })],
        visits: [
          makeVisit({ id: 'a', status: 'IN_CHAIR', assignedDoctorId: 'doc-1' }),
          makeVisit({ id: 'b', status: 'WAITING', assignedDoctorId: 'doc-1' }),
          makeVisit({ id: 'c', status: 'WAITING', assignedDoctorId: 'doc-2' }),
        ],
      }),
    );
    const groups = getByDoctor(state);
    const asha = groups.find((g) => g.doctorId === 'doc-1')!;
    expect(asha.inChair?.id).toBe('a');
    expect(asha.waiting.map((v) => v.id)).toEqual(['b']);
    const vikram = groups.find((g) => g.doctorId === 'doc-2')!;
    expect(vikram.inChair).toBeNull();
    expect(vikram.waiting.map((v) => v.id)).toEqual(['c']);
  });

  it('waitingCountByDoctor counts only waiting visits', () => {
    const state = hydrateState(
      makeSnapshot({
        visits: [
          makeVisit({ id: 'a', status: 'WAITING', assignedDoctorId: 'doc-1' }),
          makeVisit({ id: 'b', status: 'WAITING', assignedDoctorId: 'doc-1' }),
          makeVisit({ id: 'c', status: 'IN_CHAIR', assignedDoctorId: 'doc-1' }),
        ],
      }),
    );
    expect(waitingCountByDoctor(state).get('doc-1')).toBe(2);
  });
});
