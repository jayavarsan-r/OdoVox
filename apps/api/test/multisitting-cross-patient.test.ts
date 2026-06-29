import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  seedActivePlan,
  seedConsultation,
} from './helpers.js';
import { commitConsultation } from '../src/lib/consultation/commit.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const data = (planId: string) => ({
  procedure: 'RCT',
  teeth: [26],
  sittingCurrent: 3,
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

describe('multi-sitting safety — cross-patient plan reference', () => {
  it('throws 422 PLAN_PATIENT_MISMATCH when continuesPlanId belongs to another patient in the same clinic', async () => {
    const setup = await createDoctorWithClinic(app);

    // Patient A owns the plan; the consultation is for patient B.
    const patientA = await createPatient(app, setup.clinicId, setup.userId);
    const { planId } = await seedActivePlan(app, setup.clinicId, setup.userId, patientA, {
      completedSittings: 2,
      totalSittings: 4,
    });

    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, data('placeholder'));

    await expect(
      commitConsultation(app.prisma, {
        consultationId,
        structuredData: data(planId),
        userId: setup.userId,
        confirmedWithWarning: false,
      }),
    ).rejects.toMatchObject({ code: 'PLAN_PATIENT_MISMATCH', statusCode: 422 });
  });
});
