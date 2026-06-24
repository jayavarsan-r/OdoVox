import { describe, expect, it } from 'vitest';
import { canManageQueue, canReassign, nextPriority, reassignActions, reassignTargets } from './reassign';
import { makeDoctor, makeVisit } from '../../test/queue-fixtures';

describe('reassign / priority action sheet', () => {
  it('only receptionist/admin can manage the queue', () => {
    expect(canManageQueue('RECEPTIONIST')).toBe(true);
    expect(canManageQueue('ADMIN')).toBe(true);
    expect(canManageQueue('DOCTOR')).toBe(false);
  });

  it('only waiting-side visits can be reassigned', () => {
    expect(canReassign(makeVisit({ status: 'WAITING' }))).toBe(true);
    expect(canReassign(makeVisit({ status: 'CHECKED_IN' }))).toBe(true);
    expect(canReassign(makeVisit({ status: 'IN_CHAIR' }))).toBe(false);
    expect(canReassign(makeVisit({ status: 'CHECKOUT' }))).toBe(false);
  });

  it('shows no actions for a doctor or for an in-chair visit', () => {
    expect(reassignActions('DOCTOR', makeVisit({ status: 'WAITING' }))).toEqual([]);
    expect(reassignActions('RECEPTIONIST', makeVisit({ status: 'IN_CHAIR' }))).toEqual([]);
  });

  it('shows the full action set for a receptionist on a waiting visit', () => {
    expect(reassignActions('RECEPTIONIST', makeVisit({ status: 'WAITING' }))).toEqual([
      'reassign',
      'bump',
      'lower',
      'cancel',
    ]);
  });

  it('reassign targets exclude the current owner', () => {
    const visit = makeVisit({ assignedDoctorId: 'doc-1' });
    const targets = reassignTargets([makeDoctor({ id: 'doc-1' }), makeDoctor({ id: 'doc-2' })], visit);
    expect(targets.map((d) => d.id)).toEqual(['doc-2']);
  });

  it('bump raises priority by +10, lower drops by -10', () => {
    expect(nextPriority(0, 'bump')).toBe(10);
    expect(nextPriority(0, 'lower')).toBe(-10);
    expect(nextPriority(10, 'bump')).toBe(20);
  });
});
