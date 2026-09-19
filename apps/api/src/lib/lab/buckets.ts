import type { LabCaseStatus, Prisma } from '@odovox/db';

/**
 * The three numbers frame 56 puts at the top of the lab list: ACTIVE, OVERDUE, READY.
 *
 * They are defined ONCE, here, as Prisma `where` fragments, and used for both the pill's
 * count and the list the pill filters to. That is the whole point of the file: a count
 * computed one way and a filter written another way drift apart, and then a receptionist
 * taps "1 OVERDUE" and gets three rows, or none. The pill would be lying about the clinic's
 * own work.
 *
 * Statuses come from the LabCaseStatus enum, which carries both the Phase 9.7 lifecycle
 * (SENT → ACKNOWLEDGED → IN_PROGRESS → READY → DISPATCHED → RECEIVED → FITTED) and the
 * legacy Phase 7 tail (DELIVERED, RETURNED_FOR_REWORK, COMPLETED).
 */

/** In flight: the clinic is waiting on the lab, or on itself to collect. */
const ACTIVE_STATUSES: LabCaseStatus[] = [
  'SENT',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'READY',
  'DISPATCHED',
  'ISSUE_RAISED',
  'RETURNED_FOR_REWORK',
];

/**
 * DRAFT is deliberately NOT active — nothing has been sent, so nobody is waiting. Counting
 * drafts would make a clinic that jots down five ideas look like it has five cases running.
 *
 * RECEIVED, FITTED, DELIVERED, COMPLETED and CANCELLED are finished: the work is back, or it
 * is not happening.
 */
export type LabBucket = 'active' | 'overdue' | 'ready';

export function labBucketWhere(bucket: LabBucket, now = new Date()): Prisma.LabCaseWhereInput {
  switch (bucket) {
    case 'active':
      return { status: { in: ACTIVE_STATUSES } };

    /**
     * Overdue means the lab promised it by a date that has passed AND it is not back yet.
     *
     * A case with no `expectedReturnAt` is never overdue — that date is computed from the
     * vendor's turnaround, so a case sent to a vendor with none set has no promise to break.
     * Treating null as overdue would flag every such case forever, which is how a red pill
     * becomes background noise nobody looks at.
     *
     * READY is excluded: the lab has finished. It may be sitting uncollected, which is what
     * the READY pill is for, but the LAB is not late.
     */
    case 'overdue':
      return {
        status: { in: ACTIVE_STATUSES.filter((s) => s !== 'READY') },
        expectedReturnAt: { not: null, lt: now },
      };

    /** Finished by the lab and not yet back in the clinic's hands — someone must collect it. */
    case 'ready':
      return { status: { in: ['READY', 'DISPATCHED'] } };
  }
}
