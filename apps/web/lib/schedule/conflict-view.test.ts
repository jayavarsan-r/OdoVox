import { describe, expect, it } from 'vitest';
import { deriveConflictBanner, softCodes } from './conflict-view';
import type { Conflict } from '@odovox/types';

const hard: Conflict = { kind: 'HARD', code: 'DOCTOR_DOUBLE_BOOKED', message: 'x' };
const soft: Conflict = { kind: 'SOFT', code: 'IN_LUNCH_BREAK', message: 'y' };

describe('deriveConflictBanner', () => {
  it('blocks submit on a hard conflict', () => {
    const b = deriveConflictBanner([hard]);
    expect(b.canSubmit).toBe(false);
    expect(b.severity).toBe('hard');
  });

  it('requires acknowledgement for soft conflicts, then allows submit', () => {
    const unacked = deriveConflictBanner([soft]);
    expect(unacked.canSubmit).toBe(false);
    expect(unacked.needsAck).toBe(true);
    expect(unacked.severity).toBe('soft');

    const acked = deriveConflictBanner([soft], ['IN_LUNCH_BREAK']);
    expect(acked.canSubmit).toBe(true);
    expect(acked.needsAck).toBe(false);
  });

  it('allows submit with no conflicts', () => {
    const b = deriveConflictBanner([]);
    expect(b.canSubmit).toBe(true);
    expect(b.severity).toBe('none');
  });

  it('a hard conflict still blocks even if soft is acknowledged', () => {
    const b = deriveConflictBanner([hard, soft], ['IN_LUNCH_BREAK']);
    expect(b.canSubmit).toBe(false);
  });
});

describe('softCodes', () => {
  it('extracts only soft codes', () => {
    expect(softCodes([hard, soft])).toEqual(['IN_LUNCH_BREAK']);
  });
});
