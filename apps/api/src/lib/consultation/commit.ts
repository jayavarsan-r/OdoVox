import { createHash } from 'node:crypto';
import { ClinicalExtraction, type ClinicalExtraction as ClinicalExtractionType } from '@odovox/types';
import { AppError, NotFoundError } from '../errors.js';
import { encryptField } from '../encryption.js';
import { runWithContext } from '../request-context.js';
import type { ExtendedPrismaClient } from '../../plugins/prisma.js';

export interface CommitParams {
  consultationId: string;
  structuredData: unknown;
  userId: string;
  /** True when the doctor confirmed over an un-resolved safety warning (audit trail). */
  confirmedWithWarning: boolean;
}

export interface CommitResult {
  consultationId: string;
  planId?: string;
  procedureId?: string;
  prescriptionId?: string;
  appointmentId?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Commit a confirmed consultation in a SINGLE transaction. The doctor's data is sacred: either
 * every write lands or none does. Slow/external work (STT, Gemini, PDF) NEVER runs in here — the
 * AI work finished in the workers before the verification card; the PDF is generated lazily on GET.
 *
 * Writes (atomic): Consultation → TreatmentPlan → Procedure → Sitting → Prescription → Appointment
 * → ToothRecord(s) → Visit checkout → audit. The whole body runs in a clinic-scoped context so the
 * scoped models (Visit/Appointment/Patient) get the right clinicId whether called from a route or
 * a test/worker.
 */
export async function commitConsultation(
  prisma: ExtendedPrismaClient,
  params: CommitParams,
): Promise<CommitResult> {
  const data = ClinicalExtraction.parse(params.structuredData);

  // Consultation is not clinic-scoped; the visit/patient includes ride along on the same query.
  const consult = await prisma.consultation.findUnique({
    where: { id: params.consultationId },
    include: { visit: { include: { patient: true } } },
  });
  if (!consult || consult.deletedAt) throw new NotFoundError('Consultation not found');
  if (consult.status === 'CONFIRMED') {
    throw new AppError('Consultation already confirmed', 409, 'ALREADY_CONFIRMED');
  }

  const visit = consult.visit;
  const { clinicId, patientId } = visit;
  const visitId = visit.id;
  const userId = params.userId;

  return runWithContext({ clinicId, userId }, () =>
    prisma.$transaction(async (tx) => {
      const result: CommitResult = { consultationId: consult.id };

      // 1. Consultation → CONFIRMED.
      await tx.consultation.update({
        where: { id: consult.id },
        data: {
          status: 'CONFIRMED',
          confirmedById: userId,
          confirmedAt: new Date(),
          structuredData: data as object,
          safetyWarnings: data.safetyWarnings,
        },
      });

      // 2-4. Plan → Procedure → Sitting.
      if (data.continuesPlanId) {
        // ── CONTINUATION BRANCH (Phase 5) ──────────────────────────────────────────────────────
        // Advance an existing ACTIVE plan: add the next sitting, never create a new plan/procedure.
        const plan = await tx.treatmentPlan.findUnique({
          where: { id: data.continuesPlanId },
          include: { patient: { select: { clinicId: true } } },
        });
        // Cross-clinic plans must not even reveal their existence → 404.
        if (!plan || plan.deletedAt || plan.patient.clinicId !== clinicId) {
          throw new NotFoundError('Treatment plan not found');
        }
        // Same clinic but a different patient → explicit mismatch (a doctor edited the card wrong).
        if (plan.patientId !== patientId) {
          throw new AppError('Plan belongs to a different patient', 422, 'PLAN_PATIENT_MISMATCH', {
            planId: plan.id,
          });
        }
        if (plan.status !== 'ACTIVE') {
          throw new AppError('Cannot continue an inactive or missing plan', 422, 'PLAN_NOT_ACTIVE', {
            status: plan.status,
          });
        }
        const procedure = await tx.procedure.findFirst({
          where: { planId: plan.id },
          orderBy: { createdAt: 'desc' },
        });
        if (!procedure) {
          throw new AppError('Plan has no procedure to advance', 422, 'PLAN_NOT_ACTIVE');
        }

        const nextSittingNum = procedure.completedSittings + 1;
        // Safety: a doctor can't skip sittings — sitting N must follow N-1.
        if (data.sittingCurrent != null && data.sittingCurrent > nextSittingNum) {
          throw new AppError(
            `You're skipping sittings — sitting ${nextSittingNum} was never completed`,
            422,
            'SITTING_GAP',
            { expected: nextSittingNum, got: data.sittingCurrent },
          );
        }
        result.planId = plan.id;
        result.procedureId = procedure.id;

        await tx.sitting.create({
          data: {
            procedureId: procedure.id,
            visitId,
            sittingNumber: nextSittingNum,
            completedAt: data.status === 'COMPLETED' ? new Date() : null,
            notesEnc: data.notes ? encryptField(data.notes) : null,
          },
        });
        const completedSittings = await tx.sitting.count({
          where: { procedureId: procedure.id, completedAt: { not: null } },
        });
        const procDone = completedSittings >= procedure.totalSittings;
        await tx.procedure.update({
          where: { id: procedure.id },
          data: { completedSittings, status: procDone ? 'COMPLETED' : 'IN_PROGRESS' },
        });
        if (procDone) {
          await tx.treatmentPlan.update({
            where: { id: plan.id },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
        }
      } else if (data.procedure) {
        // ── NEW-PLAN BRANCH (Phase 3 path, name-based reuse — unchanged) ────────────────────────
        const existingPlan = await tx.treatmentPlan.findFirst({
          where: { patientId, name: data.procedure, deletedAt: null, status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'desc' },
        });
        const plan =
          existingPlan ??
          (await tx.treatmentPlan.create({
            data: { patientId, name: data.procedure, status: 'ACTIVE', createdById: userId, parentVisitId: visitId },
          }));
        result.planId = plan.id;

        const existingProc = await tx.procedure.findFirst({
          where: { planId: plan.id, name: data.procedure },
          orderBy: { createdAt: 'desc' },
        });
        const totalSittings = data.sittingTotal ?? existingProc?.totalSittings ?? 1;
        const procedure = existingProc
          ? await tx.procedure.update({
              where: { id: existingProc.id },
              data: {
                toothNumbers: data.teeth.length ? data.teeth : existingProc.toothNumbers,
                totalSittings,
              },
            })
          : await tx.procedure.create({
              data: { planId: plan.id, name: data.procedure, toothNumbers: data.teeth, totalSittings, status: 'IN_PROGRESS' },
            });
        result.procedureId = procedure.id;

        if (data.sittingCurrent != null) {
          // Guard the new unique([procedureId, sittingNumber]) constraint: if this sitting number
          // already exists on the procedure (e.g. a repeat confirm), advance to the next free one.
          const clash = await tx.sitting.findUnique({
            where: { procedureId_sittingNumber: { procedureId: procedure.id, sittingNumber: data.sittingCurrent } },
          });
          const last = await tx.sitting.findFirst({
            where: { procedureId: procedure.id },
            orderBy: { sittingNumber: 'desc' },
          });
          const sittingNumber = clash ? (last?.sittingNumber ?? 0) + 1 : data.sittingCurrent;
          await tx.sitting.create({
            data: {
              procedureId: procedure.id,
              visitId,
              sittingNumber,
              completedAt: data.status === 'COMPLETED' ? new Date() : null,
              notesEnc: data.notes ? encryptField(data.notes) : null,
            },
          });
          const completedSittings = await tx.sitting.count({
            where: { procedureId: procedure.id, completedAt: { not: null } },
          });
          const status = completedSittings >= totalSittings ? 'COMPLETED' : 'IN_PROGRESS';
          await tx.procedure.update({ where: { id: procedure.id }, data: { completedSittings, status } });
        }
      }

      // 5. Prescription.
      if (data.prescriptions.length > 0) {
        const rx = await tx.prescription.create({
          data: {
            patientId,
            visitId,
            doctorId: userId,
            medicines: data.prescriptions as unknown as object,
            reviewAfterDays: data.followUp?.afterDays ?? null,
          },
        });
        result.prescriptionId = rx.id;
      }

      // 6. Follow-up appointment.
      if (data.followUp?.afterDays != null) {
        const appt = await tx.appointment.create({
          data: {
            clinicId,
            patientId,
            doctorId: userId,
            procedureType: data.followUp.procedureHint ?? data.procedure ?? 'Follow-up',
            scheduledAt: new Date(Date.now() + data.followUp.afterDays * DAY_MS),
            status: 'SCHEDULED',
            notes: `Auto-scheduled from consultation ${consult.id}`,
          },
        });
        result.appointmentId = appt.id;
      }

      // 7. Tooth status updates (upsert + append history).
      for (const t of data.toothStatusUpdates) {
        const historyEntry = {
          date: new Date().toISOString(),
          status: t.status,
          by: userId,
          notes: t.note ?? null,
        };
        const existing = await tx.toothRecord.findUnique({
          where: { patientId_toothNumber: { patientId, toothNumber: t.tooth } },
        });
        if (existing) {
          const history = Array.isArray(existing.history) ? existing.history : [];
          await tx.toothRecord.update({
            where: { id: existing.id },
            data: { status: t.status, lastUpdatedById: userId, history: [...history, historyEntry] as object },
          });
        } else {
          await tx.toothRecord.create({
            data: {
              patientId,
              toothNumber: t.tooth,
              status: t.status,
              lastUpdatedById: userId,
              history: [historyEntry] as object,
            },
          });
        }
      }

      // 8. Visit → CHECKOUT.
      await tx.visit.update({ where: { id: visitId }, data: { status: 'CHECKOUT', endedAt: new Date() } });

      // 9. Audit (atomic with the writes above).
      await tx.auditLog.create({
        data: {
          clinicId,
          userId,
          action: params.confirmedWithWarning ? 'CONSULTATION_CONFIRMED_WITH_WARNING' : 'CONSULTATION_CONFIRMED',
          entityType: 'Consultation',
          entityId: consult.id,
          metadata: {
            procedure: data.procedure,
            teeth: data.teeth,
            warnings: data.safetyWarnings,
            dataHash: hashStructured(data),
          },
        },
      });

      return result;
    }),
  );
}

function hashStructured(data: ClinicalExtractionType): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
}
