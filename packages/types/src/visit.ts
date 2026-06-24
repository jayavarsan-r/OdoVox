import { z } from 'zod';
import { ConsultationStatus, Timestamps, VisitStatus } from './common.js';

export const CreateVisitInput = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  roomId: z.string().min(1).optional(),
  chiefComplaint: z.string().max(1000).optional(),
  scheduledAt: z.coerce.date().optional(),
});
export type CreateVisitInput = z.infer<typeof CreateVisitInput>;

/** Manual, after-the-fact visit entry (Phase 2 — no voice/consultation). */
export const CreateManualVisitInput = z.object({
  doctorId: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  procedure: z.string().min(1).max(200),
  toothNumbers: z.array(z.number().int()).max(32).default([]),
  notes: z.string().max(4000).optional(),
  occurredAt: z.coerce.date().optional(),
});
export type CreateManualVisitInput = z.infer<typeof CreateManualVisitInput>;

export const UpdateVisitInput = z.object({
  status: VisitStatus.optional(),
  roomId: z.string().min(1).nullable().optional(),
  chiefComplaint: z.string().max(1000).nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  endedAt: z.coerce.date().nullable().optional(),
});
export type UpdateVisitInput = z.infer<typeof UpdateVisitInput>;

export const VisitResponse = z
  .object({
    id: z.string(),
    clinicId: z.string(),
    patientId: z.string(),
    doctorId: z.string(),
    roomId: z.string().nullable(),
    status: VisitStatus,
    tokenNumber: z.number().int(),
    scheduledAt: z.coerce.date().nullable(),
    startedAt: z.coerce.date().nullable(),
    endedAt: z.coerce.date().nullable(),
    chiefComplaint: z.string().nullable(),
  })
  .merge(Timestamps);
export type VisitResponse = z.infer<typeof VisitResponse>;

export const ConsultationResponse = z
  .object({
    id: z.string(),
    visitId: z.string(),
    /** Decrypted only for authorized reads. */
    rawTranscript: z.string().nullable(),
    structuredData: z.unknown(),
    audioUrl: z.string().nullable(),
    status: ConsultationStatus,
    confirmedAt: z.coerce.date().nullable(),
    confirmedById: z.string().nullable(),
  })
  .merge(Timestamps);
export type ConsultationResponse = z.infer<typeof ConsultationResponse>;
