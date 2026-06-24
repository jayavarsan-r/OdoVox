import { z } from 'zod';
import { VisitStatus } from './common.js';

/** A single "Needs you" item on the doctor home, with the rule that produced it. */
export const NeedsYouKind = z.enum([
  'PAYMENT_OVERDUE',
  'ALLERGY_TODAY',
  'LAB_READY',
  'MISSED_APPOINTMENT',
  'TREATMENT_STALLED',
]);
export type NeedsYouKind = z.infer<typeof NeedsYouKind>;

export const NeedsYouItem = z.object({
  kind: NeedsYouKind,
  title: z.string(),
  patientId: z.string(),
  patientName: z.string(),
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
