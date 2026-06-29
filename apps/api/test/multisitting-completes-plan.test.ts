import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedActivePlan, seedConsultation } from './helpers.js';
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

const finalSitting = (planId: string) => ({
  procedure: 'RCT',
  teeth: [26],
  sittingCurrent: 4,
  sittingTotal: 4,
  continuesPlanId: planId,
  status: 'COMPLETED' as const,
  prescriptions: [],
  followUp: null,
  toothStatusUpdates: [],
  notes: null,
  clarifications: [],
  safetyWarnings: [],
});

describe('multi-sitting — final sitting completes the plan', () => {
  it('marks both Procedure and TreatmentPlan COMPLETED on the last sitting', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId, patientId } = await seedConsultation(
      app,
      setup.clinicId,
      setup.userId,
      finalSitting('placeholder'),
    );
    const { planId, procedureId } = await seedActivePlan(app, setup.clinicId, setup.userId, patientId, {
      totalSittings: 4,
      completedSittings: 3,
    });

    await commitConsultation(app.prisma, {
      consultationId,
      structuredData: finalSitting(planId),
      userId: setup.userId,
      confirmedWithWarning: false,
    });

    await runWithContext({ clinicId: setup.clinicId, userId: setup.userId }, async () => {
      const proc = await app.prisma.procedure.findUniqueOrThrow({ where: { id: procedureId } });
      expect(proc.completedSittings).toBe(4);
      expect(proc.status).toBe('COMPLETED');

      const plan = await app.prisma.treatmentPlan.findUniqueOrThrow({ where: { id: planId } });
      expect(plan.status).toBe('COMPLETED');
      expect(plan.completedAt).not.toBeNull();
    });
  });
});
