import { z } from 'zod';

/**
 * A patient's timeline (v9 frame 42).
 *
 * Two kinds of entry share one stream because they share one question — "what has happened
 * to this patient?" — but they behave differently in time:
 *
 *  - a VISIT happened on a day and stays there;
 *  - a FACT (a recorded allergy) has no end. The frame draws it in red and it rides the
 *    timeline forever, because it constrains every prescription written after it.
 */
export const HistoryEntryKind = z.enum(['visit', 'fact']);
export type HistoryEntryKind = z.infer<typeof HistoryEntryKind>;

export const HistoryEntryZ = z.object({
  id: z.string(),
  kind: HistoryEntryKind,
  /** When it happened. Null for a fact with no recorded date — never guessed. */
  at: z.coerce.date().nullable(),
  title: z.string(),
  /** FDI numbers this entry touched. */
  teeth: z.array(z.number().int()).default([]),
  feePaise: z.number().int().nullable(),
  doctorName: z.string().nullable(),
  /** A confirmed clinical record, not a visit that merely happened. */
  confirmed: z.boolean().default(false),
  prescriptionCount: z.number().int().default(0),
  /** Frame 42's supporting line: "Reaction · rash", "Full mouth". */
  detail: z.string().nullable(),
});
export type HistoryEntry = z.infer<typeof HistoryEntryZ>;

export const PatientHistoryResponse = z.object({
  entries: z.array(HistoryEntryZ),
});
export type PatientHistoryResponse = z.infer<typeof PatientHistoryResponse>;
