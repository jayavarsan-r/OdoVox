import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedConsultation } from './helpers.js';
import { commitConsultation } from '../src/lib/consultation/commit.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('commitConsultation — confirming over a safety warning', () => {
  it('logs CONSULTATION_CONFIRMED_WITH_WARNING when confirmedWithWarning is true', async () => {
    const setup = await createDoctorWithClinic(app);
    const structured = {
      procedure: 'RCT',
      teeth: [26],
      sittingCurrent: 1,
      sittingTotal: 2,
      status: 'COMPLETED' as const,
      prescriptions: [
        { name: 'Amoxicillin', dosage: '500mg', frequency: 'TID' as const, durationDays: 5, instructions: null },
      ],
      followUp: null,
      toothStatusUpdates: [],
      notes: null,
      clarifications: [],
      safetyWarnings: ['allergy_conflict:Amoxicillin'],
    };
    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, structured, {
      allergiesEnc: null,
    });

    await commitConsultation(app.prisma, {
      consultationId,
      structuredData: structured,
      userId: setup.userId,
      confirmedWithWarning: true,
    });

    const audit = await app.prisma.auditLog.findFirst({
      where: { action: 'CONSULTATION_CONFIRMED_WITH_WARNING', entityId: consultationId },
    });
    expect(audit).toBeTruthy();
    expect((audit!.metadata as { warnings?: string[] }).warnings).toContain('allergy_conflict:Amoxicillin');
  });
});
