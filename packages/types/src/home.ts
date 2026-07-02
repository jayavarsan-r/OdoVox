import { z } from 'zod';
import { VisitStatus } from './common.js';

/** A single "Needs you" item on the doctor home, with the rule that produced it. */
export const NeedsYouKind = z.enum([
  'PAYMENT_OVERDUE',
  'ALLERGY_TODAY',
  'LAB_READY',
  'LAB_OVERDUE',
  'LAB_STUCK_READY', // Phase 9.7 §2.10: READY > 3 days, not dispatched — call the lab
  'LAB_ISSUE_STALE', // Phase 9.7 §2.10: ISSUE_RAISED > 24h unactioned
  'LOW_STOCK',
  'MISSED_APPOINTMENT',
  'TREATMENT_STALLED',
]);
export type NeedsYouKind = z.infer<typeof NeedsYouKind>;

export const NeedsYouItem = z.object({
  kind: NeedsYouKind,
  title: z.string(),
  // patient context is absent for non-patient items (e.g. LOW_STOCK).
  patientId: z.string().nullable().optional(),
  patientName: z.string().nullable().optional(),
  // Deep link the row taps through to (e.g. /lab/:id or /inventory/:id).
  href: z.string().optional(),
});
export type NeedsYouItem = z.infer<typeof NeedsYouItem>;

export const RecentVisitItem = z.object({
  id: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  date: z.coerce.date(),
  procedureSummary: z.string(),
  status: VisitStatus,
});
export type RecentVisitItem = z.infer<typeof RecentVisitItem>;

export const TodayStats = z.object({
  appointmentsToday: z.number().int(),
  patientsSeen: z.number().int(),
  inChair: z.number().int(),
  waiting: z.number().int(),
});
export type TodayStats = z.infer<typeof TodayStats>;
