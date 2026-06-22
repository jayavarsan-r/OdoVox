import { z } from 'zod';
import {
  FdiToothNumber,
  PaiseAmount,
  PlanStatus,
  ProcedureStatus,
  Timestamps,
  ToothStatus,
} from './common.js';

export const CreateTreatmentPlanInput = z.object({
  patientId: z.string().min(1),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  estimatedCostPaise: PaiseAmount.default(0),
});
export type CreateTreatmentPlanInput = z.infer<typeof CreateTreatmentPlanInput>;

export const UpdateTreatmentPlanInput = CreateTreatmentPlanInput.partial()
  .omit({ patientId: true })
  .extend({ status: PlanStatus.optional() });
export type UpdateTreatmentPlanInput = z.infer<typeof UpdateTreatmentPlanInput>;

export const TreatmentPlanResponse = z
  .object({
    id: z.string(),
    patientId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    status: PlanStatus,
    estimatedCostPaise: PaiseAmount,
  })
  .merge(Timestamps);
export type TreatmentPlanResponse = z.infer<typeof TreatmentPlanResponse>;

export const CreateProcedureInput = z.object({
  planId: z.string().min(1),
  name: z.string().min(1).max(160),
  toothNumbers: z.array(FdiToothNumber).default([]),
  totalSittings: z.number().int().min(1).default(1),
  notes: z.string().max(2000).optional(),
});
export type CreateProcedureInput = z.infer<typeof CreateProcedureInput>;

export const ProcedureResponse = z
  .object({
    id: z.string(),
    planId: z.string(),
    name: z.string(),
    toothNumbers: z.array(FdiToothNumber),
    totalSittings: z.number().int(),
    completedSittings: z.number().int(),
    status: ProcedureStatus,
    notes: z.string().nullable(),
  })
  .merge(Timestamps);
export type ProcedureResponse = z.infer<typeof ProcedureResponse>;

export const ToothRecordResponse = z
  .object({
    id: z.string(),
    patientId: z.string(),
    toothNumber: FdiToothNumber,
    status: ToothStatus,
    history: z.array(z.unknown()),
  })
  .merge(Timestamps);
export type ToothRecordResponse = z.infer<typeof ToothRecordResponse>;
