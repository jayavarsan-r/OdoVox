import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedActivePlan, seedConsultation } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';
import { commitConsultation } from '../src/lib/consultation/commit.js';
import type { AppError } from '../src/lib/errors.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const skipData = (planId: string) => ({
  procedure: 'RCT',
  teeth: [26],
  sittingCurrent: 4, // plan only has sitting 1 done → expected next is 2
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

describe('multi-sitting safety — skipping a sitting is blocked', () => {
  it('throws 422 SITTING_GAP when sittingCurrent jumps past the next sitting', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId, patientId } = await seedConsultation(
      app,
      setup.clinicId,
      setup.userId,
      skipData('placeholder'),
    );
    const { planId, procedureId } = await seedActivePlan(app, setup.clinicId, setup.userId, patientId, {
      totalSittings: 4,
      completedSittings: 1,
    });

    await expect(
      commitConsultation(app.prisma, {
        consultationId,
        structuredData: skipData(planId),
        userId: setup.userId,
        confirmedWithWarning: false,
      }),
    ).rejects.toMatchObject({ code: 'SITTING_GAP', statusCode: 422 } satisfies Partial<AppError>);

    // Nothing was written — the gap blocks the whole transaction.
    await runWithContext({ clinicId: setup.clinicId, userId: setup.userId }, async () => {
      const sittings = await app.prisma.sitting.count({ where: { procedureId } });
      expect(sittings).toBe(1);
      const consult = await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultationId } });
      expect(consult.status).toBe('PENDING_REVIEW');
    });
  });
});
