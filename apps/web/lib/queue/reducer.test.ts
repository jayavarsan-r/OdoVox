import { describe, expect, it } from 'vitest';
import type { ServerEvent } from '@odovox/types';
import { applyEvent, emptyQueueState, hydrateState } from './reducer';
import { makeSnapshot, makeVisit } from '../../test/queue-fixtures';

describe('queue reducer — applyEvent per event type', () => {
  it('checked_in inserts a waiting visit', () => {
    const v = makeVisit({ id: 'v1', status: 'WAITING' });
    const next = applyEvent(emptyQueueState(), { type: 'queue.visit.checked_in', payload: v });
    expect(next.visits.get('v1')?.status).toBe('WAITING');
    expect(next.versions.get('v1')).toBe(v.lifecycleVersion);
  });

  it('called_in updates the visit to IN_CHAIR', () => {
    let state = applyEvent(emptyQueueState(), {
      type: 'queue.visit.checked_in',
      payload: makeVisit({ id: 'v1', status: 'WAITING', lifecycleVersion: 0 }),
    });
    state = applyEvent(state, {
      type: 'queue.visit.called_in',
      payload: makeVisit({ id: 'v1', status: 'IN_CHAIR', lifecycleVersion: 1 }),
    });
    expect(state.visits.get('v1')?.status).toBe('IN_CHAIR');
  });

  it('returned moves a visit back to WAITING', () => {
    let state = applyEvent(emptyQueueState(), {
      type: 'queue.visit.called_in',
      payload: makeVisit({ id: 'v1', status: 'IN_CHAIR', lifecycleVersion: 1 }),
    });
    state = applyEvent(state, {
      type: 'queue.visit.returned',
      payload: makeVisit({ id: 'v1', status: 'WAITING', lifecycleVersion: 2 }),
    });
    expect(state.visits.get('v1')?.status).toBe('WAITING');
  });

  it('checkout moves a visit to CHECKOUT', () => {
    const state = applyEvent(emptyQueueState(), {
      type: 'queue.visit.checkout',
      payload: makeVisit({ id: 'v1', status: 'CHECKOUT', lifecycleVersion: 2 }),
    });
    expect(state.visits.get('v1')?.status).toBe('CHECKOUT');
  });

  it('reassigned updates the assigned doctor', () => {
    const state = applyEvent(emptyQueueState(), {
      type: 'queue.visit.reassigned',
      payload: makeVisit({ id: 'v1', assignedDoctorId: 'doc-2', lifecycleVersion: 1 }),
    });
    expect(state.visits.get('v1')?.assignedDoctorId).toBe('doc-2');
  });

  it('priority_changed updates the priority', () => {
    const state = applyEvent(emptyQueueState(), {
      type: 'queue.visit.priority_changed',
      payload: makeVisit({ id: 'v1', priority: 10, lifecycleVersion: 1 }),
    });
    expect(state.visits.get('v1')?.priority).toBe(10);
  });

  it('completed removes the visit from the queue', () => {
    let state = applyEvent(emptyQueueState(), {
      type: 'queue.visit.checkout',
      payload: makeVisit({ id: 'v1', status: 'CHECKOUT' }),
    });
    state = applyEvent(state, { type: 'queue.visit.completed', payload: { visitId: 'v1' } });
    expect(state.visits.has('v1')).toBe(false);
    expect(state.versions.has('v1')).toBe(false);
  });

  it('cancelled removes the visit from the queue', () => {
    let state = applyEvent(emptyQueueState(), {
      type: 'queue.visit.checked_in',
      payload: makeVisit({ id: 'v1' }),
    });
    state = applyEvent(state, { type: 'queue.visit.cancelled', payload: { visitId: 'v1', reason: 'Patient left' } });
    expect(state.visits.has('v1')).toBe(false);
  });

  it('doctor.recording.started/stopped toggles the ephemeral recording flag', () => {
    let state = applyEvent(emptyQueueState(), {
      type: 'queue.visit.called_in',
      payload: makeVisit({ id: 'v1', status: 'IN_CHAIR' }),
    });
    state = applyEvent(state, {
      type: 'doctor.recording.started',
      payload: { visitId: 'v1', doctorId: 'doc-1', patientName: 'Akhilesh' },
    });
    expect(state.visits.get('v1')?.recording).toBe(true);
    state = applyEvent(state, { type: 'doctor.recording.stopped', payload: { visitId: 'v1', doctorId: 'doc-1' } });
    expect(state.visits.get('v1')?.recording).toBe(false);
  });

  it('activity prepends to the feed and caps + dedupes', () => {
    const mk = (id: string): ServerEvent => ({
      type: 'activity',
      payload: {
        id,
        type: 'CALLED_IN',
        visitId: 'v1',
        patientId: 'p1',
        patientName: 'Akhilesh',
        byUserId: 'doc-1',
        byUserName: 'Dr. Asha',
        text: 'Asha called Akhilesh in',
        metadata: {},
        createdAt: new Date(),
      },
    });
    let state = applyEvent(emptyQueueState(), mk('a1'));
    state = applyEvent(state, mk('a2'));
    state = applyEvent(state, mk('a1')); // dedupe
    expect(state.activity.map((a) => a.id)).toEqual(['a2', 'a1']);
  });
});

describe('queue reducer — hydrate (snapshot reset)', () => {
  it('replaces local state cleanly from a snapshot', () => {
    const stale = applyEvent(emptyQueueState(), {
      type: 'queue.visit.checked_in',
      payload: makeVisit({ id: 'old', status: 'WAITING' }),
    });
    const snapshot = makeSnapshot({ visits: [makeVisit({ id: 'fresh', status: 'IN_CHAIR', lifecycleVersion: 3 })] });
    const next = applyEvent(stale, { type: 'queue.snapshot', payload: snapshot });
    expect(next.visits.has('old')).toBe(false); // snapshot is the truth — stale rows gone
    expect(next.visits.get('fresh')?.status).toBe('IN_CHAIR');
    expect(next.versions.get('fresh')).toBe(3);
  });

  it('hydrateState seeds versions from the snapshot', () => {
    const state = hydrateState(makeSnapshot({ visits: [makeVisit({ id: 'v1', lifecycleVersion: 5 })] }));
    expect(state.versions.get('v1')).toBe(5);
  });
});

describe('queue reducer — out-of-order rejection (§5.3)', () => {
  it('ignores an event carrying a lower lifecycleVersion than already seen', () => {
    let state = applyEvent(emptyQueueState(), {
      type: 'queue.visit.called_in',
      payload: makeVisit({ id: 'v1', status: 'IN_CHAIR', lifecycleVersion: 5 }),
    });
    // A delayed older event (v3) arrives after v5 — must be ignored.
    state = applyEvent(state, {
      type: 'queue.visit.returned',
      payload: makeVisit({ id: 'v1', status: 'WAITING', lifecycleVersion: 3 }),
    });
    expect(state.visits.get('v1')?.status).toBe('IN_CHAIR'); // unchanged
    expect(state.versions.get('v1')).toBe(5);
  });

  it('applies an event with an equal-or-higher version', () => {
    let state = applyEvent(emptyQueueState(), {
      type: 'queue.visit.called_in',
      payload: makeVisit({ id: 'v1', status: 'IN_CHAIR', lifecycleVersion: 5 }),
    });
    state = applyEvent(state, {
      type: 'queue.visit.checkout',
      payload: makeVisit({ id: 'v1', status: 'CHECKOUT', lifecycleVersion: 6 }),
    });
    expect(state.visits.get('v1')?.status).toBe('CHECKOUT');
  });
});
