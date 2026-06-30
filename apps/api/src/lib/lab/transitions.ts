import type { LabCaseStatus } from '@odovox/types';
import { ConflictError } from '../errors.js';

/**
 * Allowed lab-case status transitions (Phase 7 §2.2). Any move not listed here is rejected with
 * 409 INVALID_TRANSITION. COMPLETED and CANCELLED are terminal.
 */
export const LAB_TRANSITIONS: Record<LabCaseStatus, LabCaseStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['IN_PROGRESS', 'READY', 'RETURNED_FOR_REWORK', 'CANCELLED'],
  IN_PROGRESS: ['READY', 'CANCELLED'],
  READY: ['DELIVERED', 'RETURNED_FOR_REWORK', 'CANCELLED'],
  DELIVERED: ['COMPLETED', 'RETURNED_FOR_REWORK'],
  RETURNED_FOR_REWORK: ['SENT', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: LabCaseStatus, to: LabCaseStatus): boolean {
  return LAB_TRANSITIONS[from].includes(to);
}

/** Throws 409 INVALID_TRANSITION if `from → to` is not allowed. */
export function assertTransition(from: LabCaseStatus, to: LabCaseStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(
      `Cannot move lab case from ${from} to ${to}`,
      'INVALID_TRANSITION',
      { from, to, allowed: LAB_TRANSITIONS[from] },
    );
  }
}
