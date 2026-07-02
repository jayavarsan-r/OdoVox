import type { LabCaseStatus } from '@odovox/types';
import { ConflictError } from '../errors.js';

/**
 * Allowed lab-case status transitions. Phase 7 matrix extended by Phase 9.7 (§2.3): the WhatsApp
 * tracker states (ACKNOWLEDGED / DISPATCHED / RECEIVED / FITTED / ISSUE_RAISED) join the legacy
 * Phase 7 flow (DELIVERED / RETURNED_FOR_REWORK / COMPLETED), which stays valid for existing
 * cases. Any move not listed here is rejected with 409 INVALID_TRANSITION — except a backward
 * correction by reception (see transition-service.ts). FITTED, COMPLETED and CANCELLED are terminal.
 */
export const LAB_TRANSITIONS: Record<LabCaseStatus, LabCaseStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['ACKNOWLEDGED', 'IN_PROGRESS', 'READY', 'ISSUE_RAISED', 'RETURNED_FOR_REWORK', 'CANCELLED'],
  ACKNOWLEDGED: ['IN_PROGRESS', 'READY', 'ISSUE_RAISED', 'CANCELLED'],
  IN_PROGRESS: ['READY', 'ISSUE_RAISED', 'CANCELLED'],
  READY: ['DISPATCHED', 'RECEIVED', 'DELIVERED', 'ISSUE_RAISED', 'RETURNED_FOR_REWORK', 'CANCELLED'],
  DISPATCHED: ['RECEIVED', 'ISSUE_RAISED', 'CANCELLED'],
  RECEIVED: ['FITTED', 'ISSUE_RAISED', 'CANCELLED'],
  ISSUE_RAISED: ['IN_PROGRESS', 'CANCELLED'],
  DELIVERED: ['COMPLETED', 'RETURNED_FOR_REWORK'],
  RETURNED_FOR_REWORK: ['SENT', 'CANCELLED'],
  FITTED: [],
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

/** Statuses that count as "open" for parsing scope + analytics (not terminal). */
export const OPEN_LAB_STATUSES: LabCaseStatus[] = [
  'SENT',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'READY',
  'DISPATCHED',
  'RECEIVED',
  'ISSUE_RAISED',
];
