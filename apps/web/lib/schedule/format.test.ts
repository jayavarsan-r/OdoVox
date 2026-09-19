import { describe, expect, it } from 'vitest';
import { appointmentChip, durationLabel } from './format';

describe('appointmentChip', () => {
  it('says nothing about an ordinary booked appointment', () => {
    // A "Scheduled" chip on every row is a column of the same word. The chips exist to mark
    // the rows that have MOVED.
    expect(appointmentChip('SCHEDULED')).toBeNull();
  });

  it('marks the ones that moved', () => {
    expect(appointmentChip('CHECKED_IN')).toEqual({ label: 'Waiting', tone: 'sky' });
    expect(appointmentChip('COMPLETED')).toEqual({ label: '✓', tone: 'live' });
  });

  it('gives a no-show the only crit chip on the screen', () => {
    // It is the one state that needs chasing, so it is the one that reads as urgent.
    expect(appointmentChip('NO_SHOW')).toEqual({ label: 'No-show', tone: 'crit' });
    expect(appointmentChip('CANCELLED')?.tone).toBe('neutral');
  });

  it('does not invent a chip for a status it has never seen', () => {
    expect(appointmentChip('SOMETHING_NEW')).toBeNull();
  });
});

describe('durationLabel', () => {
  it('reads the way a receptionist says it', () => {
    expect(durationLabel(30)).toBe('30m');
    expect(durationLabel(60)).toBe('1h');
    expect(durationLabel(90)).toBe('1h 30m');
  });
});
