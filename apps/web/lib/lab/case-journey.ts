import type { LabCaseStatus } from '@odovox/types';

/**
 * Frame 58's six-step stepper, and the one action that follows from it.
 *
 * The case screen offered FIVE buttons at once — Lab confirmed, In progress, Mark ready,
 * Raise issue, Cancel — all the same size, with a red Cancel beside the thing you actually
 * came to do. Every legal transition, presented as an equal choice, so the screen asked the
 * doctor to know the lifecycle rather than telling them where the case had got to.
 *
 * The frame's answer: draw the journey, mark where it is, and offer the ONE step forward
 * plus two escapes. This computes both from the status, so the two can never disagree.
 */

export type StepState = 'done' | 'now' | 'ahead';

export interface JourneyStep {
  label: string;
  state: StepState;
}

/**
 * The happy path, in order. Deliberately NOT every status in the enum: ISSUE_RAISED,
 * RETURNED_FOR_REWORK and CANCELLED are departures from this line, not points on it, and
 * drawing them as steps would suggest every case passes through a rework.
 */
const LINE: { label: string; statuses: LabCaseStatus[] }[] = [
  { label: 'Sent', statuses: ['SENT'] },
  { label: 'Confirm', statuses: ['ACKNOWLEDGED'] },
  { label: 'Prod', statuses: ['IN_PROGRESS', 'ISSUE_RAISED', 'RETURNED_FOR_REWORK'] },
  { label: 'Ready', statuses: ['READY'] },
  { label: 'Recvd', statuses: ['DISPATCHED', 'RECEIVED'] },
  { label: 'Fitted', statuses: ['FITTED', 'DELIVERED', 'COMPLETED'] },
];

/**
 * Where the case is on the line.
 *
 * DRAFT is before the line starts, so nothing is done and nothing is current — the whole
 * journey reads as ahead, which is true: it has not been sent.
 *
 * A case parked in ISSUE_RAISED sits on Prod rather than jumping backwards, because that is
 * where the work actually is; the issue itself is surfaced separately, in crit, where it
 * cannot be mistaken for progress.
 */
export function labJourney(status: LabCaseStatus): JourneyStep[] {
  const idx = LINE.findIndex((s) => s.statuses.includes(status));

  return LINE.map((s, i) => ({
    label: s.label,
    state: idx === -1 ? 'ahead' : i < idx ? 'done' : i === idx ? 'now' : 'ahead',
  }));
}

export interface NextAction {
  /** The status this moves the case to — the API action name is derived from it. */
  to: LabCaseStatus;
  label: string;
}

/**
 * The single step forward, or null when there is nothing left to do.
 *
 * One action, not five. A case in production has exactly one useful next move — "Mark ready"
 * — and offering "Lab confirmed" beside it invites a doctor to walk the case backwards
 * through a lifecycle they should not have to hold in their head.
 */
const NEXT: Partial<Record<LabCaseStatus, NextAction>> = {
  DRAFT: { to: 'SENT', label: 'Send to lab' },
  SENT: { to: 'ACKNOWLEDGED', label: 'Lab confirmed' },
  ACKNOWLEDGED: { to: 'IN_PROGRESS', label: 'In production' },
  IN_PROGRESS: { to: 'READY', label: 'Mark ready' },
  READY: { to: 'RECEIVED', label: 'Received at clinic' },
  DISPATCHED: { to: 'RECEIVED', label: 'Received at clinic' },
  RECEIVED: { to: 'FITTED', label: 'Fitted to patient' },
  // A case in rework goes back to production, not forward.
  ISSUE_RAISED: { to: 'IN_PROGRESS', label: 'Back in production' },
  RETURNED_FOR_REWORK: { to: 'IN_PROGRESS', label: 'Back in production' },
};

export function labNextAction(status: LabCaseStatus): NextAction | null {
  return NEXT[status] ?? null;
}

/** Whether raising an issue still makes sense — a finished or cancelled case cannot. */
export function canRaiseIssue(status: LabCaseStatus): boolean {
  return !['DRAFT', 'FITTED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'ISSUE_RAISED'].includes(
    status,
  );
}
