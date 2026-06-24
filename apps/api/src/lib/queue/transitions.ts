import type { VisitStatus } from '@odovox/db';
import { AppError } from '../errors.js';

/**
 * The queue state machine (Part 3.1). Pure + DB-free so it can be unit-tested. Each named action
 * declares the `from` states it is legal in and the `to` state it produces. Status-preserving
 * actions (reassign / priority) aren't status transitions — they only mutate attributes — so they
 * live in the separate "mutable" sets below.
 *
 *   SCHEDULED  → CHECKED_IN, CANCELLED, NO_SHOW
 *   CHECKED_IN → WAITING
 *   WAITING    → IN_CHAIR (call-in), CANCELLED  (+ reassign/priority keep it WAITING)
 *   IN_CHAIR   → WAITING (return), CHECKOUT (consult confirmed), CANCELLED
 *   CHECKOUT   → COMPLETED, IN_CHAIR (rare), CANCELLED
 *   COMPLETED / CANCELLED / NO_SHOW → terminal
 */
export type QueueAction =
  | 'checkIn'
  | 'callIn'
  | 'returnToQueue'
  | 'checkout'
  | 'reopen'
  | 'complete'
  | 'cancel';

interface TransitionRule {
  from: VisitStatus[];
  to: VisitStatus;
}

export const TRANSITIONS: Record<QueueAction, TransitionRule> = {
  checkIn: { from: ['SCHEDULED', 'CHECKED_IN'], to: 'WAITING' },
  callIn: { from: ['WAITING'], to: 'IN_CHAIR' },
  returnToQueue: { from: ['IN_CHAIR'], to: 'WAITING' },
  checkout: { from: ['IN_CHAIR'], to: 'CHECKOUT' },
  reopen: { from: ['CHECKOUT'], to: 'IN_CHAIR' },
  complete: { from: ['CHECKOUT'], to: 'COMPLETED' },
  cancel: { from: ['SCHEDULED', 'CHECKED_IN', 'WAITING', 'IN_CHAIR', 'CHECKOUT'], to: 'CANCELLED' },
};

/** Visits that may still be reassigned to another doctor or reprioritised (not yet in the chair). */
export const REORDERABLE_FROM: VisitStatus[] = ['SCHEDULED', 'CHECKED_IN', 'WAITING'];

export const TERMINAL_STATES: VisitStatus[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

export function targetStatus(action: QueueAction): VisitStatus {
  return TRANSITIONS[action].to;
}

export function isLegalTransition(action: QueueAction, from: VisitStatus): boolean {
  return TRANSITIONS[action].from.includes(from);
}

/** Throw 409 INVALID_TRANSITION unless `from` is a legal source state for `action`. */
export function assertTransition(action: QueueAction, from: VisitStatus): VisitStatus {
  if (!isLegalTransition(action, from)) {
    throw new AppError(
      `Cannot ${action} a visit that is ${from}`,
      409,
      'INVALID_TRANSITION',
      { action, from, allowedFrom: TRANSITIONS[action].from },
    );
  }
  return targetStatus(action);
}

export function isReorderable(from: VisitStatus): boolean {
  return REORDERABLE_FROM.includes(from);
}

export function assertReorderable(from: VisitStatus): void {
  if (!isReorderable(from)) {
    throw new AppError(
      `Cannot reorder a visit that is ${from}`,
      409,
      'INVALID_TRANSITION',
      { from, allowedFrom: REORDERABLE_FROM },
    );
  }
}
