import type { Conflict } from '@odovox/types';

export interface ConflictBanner {
  hard: Conflict[];
  soft: Conflict[];
  /** Submit is blocked while any hard conflict exists, or any soft conflict is unacknowledged. */
  canSubmit: boolean;
  /** True when there are soft conflicts the user must tick "I acknowledge" for. */
  needsAck: boolean;
  /** Severity for the banner colour. */
  severity: 'none' | 'soft' | 'hard';
}

/**
 * Derive the new-appointment sheet's conflict banner state from server/client conflicts and the set
 * of soft codes the user has acknowledged. Mirrors the server gate (server stays authoritative).
 */
export function deriveConflictBanner(conflicts: Conflict[], acknowledged: string[] = []): ConflictBanner {
  const hard = conflicts.filter((c) => c.kind === 'HARD');
  const soft = conflicts.filter((c) => c.kind === 'SOFT');
  const unackedSoft = soft.filter((c) => !acknowledged.includes(c.code));
  return {
    hard,
    soft,
    needsAck: unackedSoft.length > 0,
    canSubmit: hard.length === 0 && unackedSoft.length === 0,
    severity: hard.length > 0 ? 'hard' : soft.length > 0 ? 'soft' : 'none',
  };
}

/** Codes the user is acknowledging (all soft codes), for the create/reschedule payload. */
export function softCodes(conflicts: Conflict[]): string[] {
  return conflicts.filter((c) => c.kind === 'SOFT').map((c) => c.code);
}
