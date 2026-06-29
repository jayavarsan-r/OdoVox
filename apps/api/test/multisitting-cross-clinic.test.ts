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

describe('multi-sitting isolation — cross-clinic plan reference', () => {
  it('throws 404 (hides existence) when continuesPlanId belongs to another clinic', async () => {
    const clinicA = await createDoctorWithClinic(app);
    const clinicB = await createDoctorWithClinic(app);

    // Plan lives in clinic A.
    const patientA = await createPatient(app, clinicA.clinicId, clinicA.userId);
    const { planId } = await seedActivePlan(app, clinicA.clinicId, clinicA.userId, patientA, {
      completedSittings: 2,
      totalSittings: 4,
    });

    // Consultation is in clinic B, pointing at clinic A's plan.
    const { consultationId } = await seedConsultation(app, clinicB.clinicId, clinicB.userId, data('placeholder'));

    await expect(
      commitConsultation(app.prisma, {
        consultationId,
        structuredData: data(planId),
        userId: clinicB.userId,
        confirmedWithWarning: false,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
