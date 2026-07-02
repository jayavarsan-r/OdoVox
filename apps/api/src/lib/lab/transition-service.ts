import type { LabCase, LabCaseEvent } from '@odovox/db';
import type { LabCaseStatus } from '@odovox/types';
import type { ExtendedPrismaClient } from '../../plugins/prisma.js';
import { ConflictError, UnprocessableError } from '../errors.js';
import { LAB_TRANSITIONS, canTransition } from './transitions.js';
import { allocateCaseCode } from './case-code.js';

/**
 * Phase 9.7 §2.3 — the ONE way a lab case changes status. Every caller (manual buttons, voice,
 * button webhooks, tier 2/3 parsers) goes through `transitionLabCase`, which enforces:
 *   1. the transition matrix (lib/lab/transitions.ts)
 *   2. forward-only by default; backward corrections require the reception_manual trigger
 *   3. llm_parse only at confidence ≥ 0.85
 *   4. timeout_job NEVER changes status — timeouts nudge/alert only
 *   5. the LabCaseEvent history row is written in the SAME transaction
 *   6. idempotency: replaying the same waMessageId (sourceLabMessageId) is a no-op
 * Side effects (T-sends, notifications, broadcasts) run AFTER commit — see the callers.
 */

export type LabTrigger =
  | 'lab_button'
  | 'lab_text'
  | 'llm_parse'
  | 'reception_manual'
  | 'reception_voice'
  | 'timeout_job';

export const LLM_CONFIDENCE_GATE = 0.85;

export interface TransitionLabCaseInput {
  clinicId: string;
  caseId: string;
  to: LabCaseStatus;
  trigger: LabTrigger;
  note?: string | null;
  byUserId?: string | null;
  /** The inbound LabMessage that caused this — doubles as the idempotency key. */
  sourceLabMessageId?: string | null;
  /** Required for llm_parse; gated at ≥ 0.85. */
  parseConfidence?: number | null;
}

export interface TransitionResult {
  labCase: LabCase;
  event: LabCaseEvent;
  /** True when the same sourceLabMessageId had already transitioned — nothing was written. */
  replayed: boolean;
}

/** Status-specific timestamp columns kept in sync on transition. */
function timestampPatch(to: LabCaseStatus): Record<string, Date> {
  const now = new Date();
  switch (to) {
    case 'SENT':
      return { sentAt: now };
    case 'READY':
      return { returnedAt: now };
    case 'FITTED':
      return { deliveredAt: now, completedAt: now };
    case 'COMPLETED':
      return { completedAt: now };
    case 'DELIVERED':
      return { deliveredAt: now };
    default:
      return {};
  }
}

export async function transitionLabCase(
  prisma: ExtendedPrismaClient,
  input: TransitionLabCaseInput,
): Promise<TransitionResult> {
  const { clinicId, caseId, to, trigger } = input;

  // Rule 4 — timeouts never move a case; they only nudge/alert.
  if (trigger === 'timeout_job') {
    throw new UnprocessableError('Timeout jobs never change case status', 'TIMEOUT_CANNOT_TRANSITION');
  }
  // Rule 3 — LLM parses are gated hard at 0.85.
  if (trigger === 'llm_parse' && (input.parseConfidence == null || input.parseConfidence < LLM_CONFIDENCE_GATE)) {
    throw new UnprocessableError(
      `LLM transitions require confidence ≥ ${LLM_CONFIDENCE_GATE}`,
      'LLM_CONFIDENCE_TOO_LOW',
      { parseConfidence: input.parseConfidence ?? null },
    );
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.labCase.findFirstOrThrow({ where: { id: caseId, clinicId } });

    // Rule 6 — idempotent per source message (duplicate webhooks are a fact of life).
    if (input.sourceLabMessageId) {
      const prior = await tx.labCaseEvent.findFirst({
        where: { clinicId, labCaseId: caseId, sourceLabMessageId: input.sourceLabMessageId },
      });
      if (prior) return { labCase: existing, event: prior, replayed: true };
    }

    // Rules 1–2 — matrix forward moves for everyone; backward corrections only by reception.
    const forward = canTransition(existing.status, to);
    if (!forward && trigger !== 'reception_manual') {
      throw new ConflictError(`Cannot move lab case from ${existing.status} to ${to}`, 'INVALID_TRANSITION', {
        from: existing.status,
        to,
        allowed: LAB_TRANSITIONS[existing.status],
      });
    }
    if (existing.status === to) {
      throw new ConflictError(`Case is already ${to}`, 'INVALID_TRANSITION', { from: existing.status, to });
    }

    // Legacy cases get their human code on first 9.7 transition (new cases get it at creation).
    const caseCode = existing.caseCode ?? (await allocateCaseCode(tx, clinicId));

    const labCase = await tx.labCase.update({
      where: { id: caseId },
      data: {
        status: to,
        caseCode,
        statusUpdatedAt: new Date(),
        statusUpdatedBy: trigger,
        ...timestampPatch(to),
        ...(to === 'CANCELLED' || to === 'ISSUE_RAISED' ? { rejectionReason: input.note ?? existing.rejectionReason } : {}),
      },
    });
    const event = await tx.labCaseEvent.create({
      data: {
        clinicId,
        labCaseId: caseId,
        fromStatus: existing.status,
        toStatus: to,
        trigger,
        sourceLabMessageId: input.sourceLabMessageId ?? null,
        note: input.note ?? null,
        byUserId: input.byUserId ?? null,
      },
    });
    return { labCase, event, replayed: false };
  });
}

/**
 * One-tap undo of an LLM-parsed transition (§2.13): reverses the event's status change as a
 * reception_manual backward move and marks the original event undone. 24h window.
 */
export async function undoLlmTransition(
  prisma: ExtendedPrismaClient,
  args: { clinicId: string; eventId: string; byUserId: string },
): Promise<TransitionResult> {
  const event = await prisma.labCaseEvent.findFirstOrThrow({ where: { id: args.eventId, clinicId: args.clinicId } });
  if (event.trigger !== 'llm_parse') {
    throw new UnprocessableError('Only AI-parsed transitions can be undone here', 'NOT_LLM_EVENT');
  }
  if (event.undoneAt) {
    throw new ConflictError('This transition was already undone', 'ALREADY_UNDONE');
  }
  if (Date.now() - event.createdAt.getTime() > 24 * 60 * 60 * 1000) {
    throw new UnprocessableError('Undo window (24h) has passed', 'UNDO_WINDOW_PASSED');
  }
  const result = await transitionLabCase(prisma, {
    clinicId: args.clinicId,
    caseId: event.labCaseId,
    to: (event.fromStatus ?? 'SENT') as LabCaseStatus,
    trigger: 'reception_manual',
    note: 'Undo of AI-parsed status',
    byUserId: args.byUserId,
  });
  await prisma.labCaseEvent.update({ where: { id: event.id }, data: { undoneAt: new Date() } });
  return result;
}
