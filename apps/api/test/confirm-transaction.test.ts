import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedConsultation } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';
import { commitConsultation } from '../src/lib/consultation/commit.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const FINAL = {
  procedure: 'RCT',
  teeth: [26],
  sittingCurrent: 3,
  sittingTotal: 4,
  status: 'COMPLETED' as const,
  prescriptions: [
    { name: 'Amoxicillin', dosage: '500mg', frequency: 'TID' as const, durationDays: 5, instructions: null },
  ],
  followUp: { afterDays: 7, procedureHint: 'Crown' },
  toothStatusUpdates: [{ tooth: 26, status: 'RCT' as const, note: null }],
  notes: null,
  clarifications: [],
  safetyWarnings: [],
};

describe('commitConsultation — atomic confirm', () => {
  it('writes Consultation + Plan + Procedure + Sitting + Prescription + Appointment + ToothRecord + Visit checkout in one transaction', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId, visitId, patientId } = await seedConsultation(
      app,
      setup.clinicId,
      setup.userId,
      FINAL,
    );

    await commitConsultation(app.prisma, {
      consultationId,
      structuredData: FINAL,
      userId: setup.userId,
      confirmedWithWarning: false,
    });

    await runWithContext({ clinicId: setup.clinicId, userId: setup.userId }, async () => {
      const consult = await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultationId } });
      expect(consult.status).toBe('CONFIRMED');
      expect(consult.confirmedById).toBe(setup.userId);

      const plan = await app.prisma.treatmentPlan.findFirstOrThrow({ where: { patientId } });
      const procedure = await app.prisma.procedure.findFirstOrThrow({ where: { planId: plan.id } });
      expect(procedure.toothNumbers).toContain(26);
      expect(procedure.totalSittings).toBe(4);
      expect(procedure.completedSittings).toBe(1);

      const sitting = await app.prisma.sitting.findFirstOrThrow({ where: { procedureId: procedure.id } });
      expect(sitting.sittingNumber).toBe(3);
      expect(sitting.visitId).toBe(visitId);

      const rx = await app.prisma.prescription.findFirstOrThrow({ where: { patientId } });
      expect((rx.medicines as { name: string }[])[0]!.name).toBe('Amoxicillin');

      const appt = await app.prisma.appointment.findFirstOrThrow({ where: { patientId } });
      expect(appt.status).toBe('SCHEDULED');

      const tooth = await app.prisma.toothRecord.findFirstOrThrow({ where: { patientId, toothNumber: 26 } });
      expect(tooth.status).toBe('RCT');
      expect((tooth.history as unknown[]).length).toBeGreaterThanOrEqual(1);

      const visit = await app.prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
      expect(visit.status).toBe('CHECKOUT');
      expect(visit.endedAt).not.toBeNull();
    });
  });

  it('writes a CONSULTATION_CONFIRMED audit row', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, FINAL);
    await commitConsultation(app.prisma, {
      consultationId,
      structuredData: FINAL,
      userId: setup.userId,
      confirmedWithWarning: false,
    });
    const audit = await app.prisma.auditLog.findFirst({
      where: { action: 'CONSULTATION_CONFIRMED', entityId: consultationId },
    });
    expect(audit).toBeTruthy();
  });

  it('rolls back ALL writes if the Appointment insert (step 6) fails', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId, visitId, patientId } = await seedConsultation(
      app,
      setup.clinicId,
      setup.userId,
      FINAL,
    );

    // Fault only the Appointment insert — the rest of the transaction must roll back with it.
    const faulted = app.prisma.$extends({
      query: { appointment: { async create() { throw new Error('boom appointment'); } } },
    });

    await expect(
      commitConsultation(faulted as unknown as typeof app.prisma, {
        consultationId,
        structuredData: FINAL,
        userId: setup.userId,
        confirmedWithWarning: false,
      }),
    ).rejects.toThrow(/boom appointment/);

    await runWithContext({ clinicId: setup.clinicId, userId: setup.userId }, async () => {
      // Steps 1-5 must have rolled back.
      const consult = await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultationId } });
      expect(consult.status).toBe('PENDING_REVIEW'); // step 1 rolled back
      expect(await app.prisma.treatmentPlan.count({ where: { patientId } })).toBe(0);
      expect(await app.prisma.procedure.count({ where: { plan: { patientId } } })).toBe(0);
      expect(await app.prisma.prescription.count({ where: { patientId } })).toBe(0);
      expect(await app.prisma.appointment.count({ where: { patientId } })).toBe(0);
      const visit = await app.prisma.visit.findUniqueOrThrow({ where: { id: visitId } });
      expect(visit.status).toBe('IN_CHAIR'); // step 8 rolled back
    });
  });

  it('refuses to confirm an already-confirmed consultation', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, FINAL);
    await commitConsultation(app.prisma, {
      consultationId,
      structuredData: FINAL,
      userId: setup.userId,
      confirmedWithWarning: false,
    });
    await expect(
      commitConsultation(app.prisma, {
        consultationId,
        structuredData: FINAL,
        userId: setup.userId,
        confirmedWithWarning: false,
      }),
    ).rejects.toThrow();
  });
});
