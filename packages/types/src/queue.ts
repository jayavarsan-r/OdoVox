import { z } from 'zod';
import { PaiseAmount, PaymentMethod } from './common.js';

/**
 * Queue command inputs (Phase 4). Every queue mutation is a REST call validated by one of these;
 * the handler performs the transition (optimistic-locked), writes audit + QueueEvent, and
 * broadcasts via Socket.IO — all in one transaction.
 */

/** POST /visits — receptionist creates a walk-in (lands directly in WAITING). */
export const CreateWalkInInput = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  chiefComplaint: z.string().max(1000).optional(),
  appointmentId: z.string().min(1).optional(),
  procedureType: z.string().max(200).optional(),
  priority: z.number().int().min(-100).max(100).default(0),
});
export type CreateWalkInInput = z.infer<typeof CreateWalkInInput>;

/** POST /visits/:id/check-in — receptionist marks a scheduled patient arrived (→ WAITING). */
export const CheckInInput = z.object({
  doctorId: z.string().min(1).optional(),
  priority: z.number().int().min(-100).max(100).optional(),
});
export type CheckInInput = z.infer<typeof CheckInInput>;

/** POST /visits/:id/call-in — doctor moves a waiting patient to the chair. */
export const CallInInput = z.object({
  roomId: z.string().min(1).optional(),
});
export type CallInInput = z.infer<typeof CallInInput>;

/** POST /visits/:id/return-to-queue — doctor sends the in-chair patient back to WAITING. */
export const ReturnToQueueInput = z.object({
  reason: z.string().max(200).optional(),
});
export type ReturnToQueueInput = z.infer<typeof ReturnToQueueInput>;

/** POST /visits/:id/checkout — manual IN_CHAIR → CHECKOUT (consultation confirm does this too). */
export const CheckoutInput = z.object({
  reason: z.string().max(200).optional(),
});
export type CheckoutInput = z.infer<typeof CheckoutInput>;

/** POST /visits/:id/complete — receptionist finishes checkout (payment + handover + next visit). */
export const CompleteVisitInput = z.object({
  payment: z
    .object({
      method: PaymentMethod,
      amountPaise: PaiseAmount,
      reference: z.string().max(120).optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
  prescriptionHanded: z.boolean().default(false),
  nextVisitConfirmed: z.boolean().default(false),
});
export type CompleteVisitInput = z.infer<typeof CompleteVisitInput>;

/** POST /visits/:id/cancel — either role cancels a non-terminal visit; reason required. */
export const CancelVisitInput = z.object({
  reason: z.string().min(1).max(200),
});
export type CancelVisitInput = z.infer<typeof CancelVisitInput>;

/** POST /visits/:id/reassign — receptionist moves a waiting visit to another doctor. */
export const ReassignInput = z.object({
  doctorId: z.string().min(1),
});
export type ReassignInput = z.infer<typeof ReassignInput>;

/** POST /visits/:id/priority — receptionist bumps/lowers priority (higher = sooner). */
export const PriorityInput = z.object({
  priority: z.number().int().min(-100).max(100),
});
export type PriorityInput = z.infer<typeof PriorityInput>;

/** GET /queue ?doctor=me|all — which slice of the clinic queue to return. */
export const QueueFilter = z.enum(['me', 'all']);
export type QueueFilter = z.infer<typeof QueueFilter>;

/**
 * Receptionist checkout form (web). Lives here so the web app reuses the types-package zod build
 * (the web app has no direct zod dependency). Phase 8 reworks billing with Razorpay.
 */
export const CheckoutFormInput = z
  .object({
    takePayment: z.boolean(),
    method: PaymentMethod,
    amountPaise: z.number().int('Enter a whole amount').nonnegative('Amount can’t be negative'),
    reference: z.string().max(120).optional(),
    notes: z.string().max(500).optional(),
    prescriptionHanded: z.boolean(),
    nextVisitConfirmed: z.boolean(),
  })
  .refine((v) => !v.takePayment || v.amountPaise > 0, {
    message: 'Enter the amount received',
    path: ['amountPaise'],
  });
export type CheckoutFormInput = z.infer<typeof CheckoutFormInput>;
