import { describe, expect, it } from 'vitest';
import { canRaiseIssue, labJourney, labNextAction } from './case-journey';

/**
 * Frame 58's stepper and its single next action.
 *
 * The screen used to offer five transitions at once, all the same size, with a red Cancel
 * beside the thing you came to do — asking the doctor to know the lifecycle instead of
 * telling them where the case had got to. These assert the replacement says one thing.
 */

const labels = (s: Parameters<typeof labJourney>[0]) => labJourney(s).map((x) => x.state);

describe('labJourney', () => {
  it('draws the six steps of the happy path', () => {
    expect(labJourney('SENT').map((s) => s.label)).toEqual([
      'Sent',
      'Confirm',
      'Prod',
      'Ready',
      'Recvd',
      'Fitted',
    ]);
  });

  it('marks everything before the current step done', () => {
    expect(labels('READY')).toEqual(['done', 'done', 'done', 'now', 'ahead', 'ahead']);
  });

  it('puts a DRAFT before the line starts — nothing sent, nothing done', () => {
    expect(labels('DRAFT')).toEqual(['ahead', 'ahead', 'ahead', 'ahead', 'ahead', 'ahead']);
  });

  it('keeps a case with a raised issue ON production, not walked backwards', () => {
    // That is where the work actually is. The issue is surfaced separately, in crit, where
    // it cannot be mistaken for progress.
    expect(labels('ISSUE_RAISED')).toEqual(['done', 'done', 'now', 'ahead', 'ahead', 'ahead']);
  });

  it('treats the legacy Phase 7 tail as fitted', () => {
    expect(labels('COMPLETED')).toEqual(['done', 'done', 'done', 'done', 'done', 'now']);
    expect(labels('DELIVERED')).toEqual(['done', 'done', 'done', 'done', 'done', 'now']);
  });

  it('shows DISPATCHED and RECEIVED as the same point on the line', () => {
    expect(labels('DISPATCHED')).toEqual(labels('RECEIVED'));
  });
});

describe('labNextAction', () => {
  it('offers exactly one step forward from each live status', () => {
    expect(labNextAction('IN_PROGRESS')).toEqual({ to: 'READY', label: 'Mark ready' });
    expect(labNextAction('SENT')).toEqual({ to: 'ACKNOWLEDGED', label: 'Lab confirmed' });
  });

  it('sends a rework back to production rather than forward', () => {
    expect(labNextAction('ISSUE_RAISED')?.to).toBe('IN_PROGRESS');
    expect(labNextAction('RETURNED_FOR_REWORK')?.to).toBe('IN_PROGRESS');
  });

  it('has nothing to offer on a finished or cancelled case', () => {
    expect(labNextAction('FITTED')).toBeNull();
    expect(labNextAction('CANCELLED')).toBeNull();
    expect(labNextAction('COMPLETED')).toBeNull();
  });

  it('never offers a move the case has already made', () => {
    // The old screen let you press "Lab confirmed" on a case already in production.
    expect(labNextAction('IN_PROGRESS')?.to).not.toBe('ACKNOWLEDGED');
  });
});

describe('canRaiseIssue', () => {
  it('is available while the lab still has the work', () => {
    expect(canRaiseIssue('IN_PROGRESS')).toBe(true);
    expect(canRaiseIssue('READY')).toBe(true);
  });

  it('is not offered on a draft, a finished case, or one already in dispute', () => {
    expect(canRaiseIssue('DRAFT')).toBe(false);
    expect(canRaiseIssue('FITTED')).toBe(false);
    expect(canRaiseIssue('CANCELLED')).toBe(false);
    expect(canRaiseIssue('ISSUE_RAISED')).toBe(false);
  });
});
