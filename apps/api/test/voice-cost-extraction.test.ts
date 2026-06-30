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

const data = (over: Record<string, unknown> = {}) => ({
  procedure: 'RCT', teeth: [26], sittingCurrent: 1, sittingTotal: 1, continuesPlanId: null,
  status: 'COMPLETED' as const, estimatedCostPaise: 500000, prescriptions: [], followUp: null,
  toothStatusUpdates: [], notes: null, clarifications: [], safetyWarnings: [], ...over,
});

describe('Voice cost extraction', () => {
  it('saves the dictated cost to Procedure.estimatedCostPaise on confirm', async () => {
    const s = await createDoctorWithClinic(app);
    const { consultationId, patientId } = await seedConsultation(app, s.clinicId, s.userId, data());
    const result = await commitConsultation(app.prisma, {
      consultationId, structuredData: data(), userId: s.userId, confirmedWithWarning: false,
    });
    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const proc = await app.prisma.procedure.findUniqueOrThrow({ where: { id: result.procedureId! } });
      expect(proc.estimatedCostPaise).toBe(500000);
      void patientId;
    });
  });

  it('leaves estimatedCostPaise at 0 when no cost was dictated', async () => {
    const s = await createDoctorWithClinic(app);
    const { consultationId } = await seedConsultation(app, s.clinicId, s.userId, data({ estimatedCostPaise: null, procedure: 'Scaling', teeth: [] }));
    const result = await commitConsultation(app.prisma, {
      consultationId, structuredData: data({ estimatedCostPaise: null, procedure: 'Scaling', teeth: [] }),
      userId: s.userId, confirmedWithWarning: false,
    });
    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      const proc = await app.prisma.procedure.findUniqueOrThrow({ where: { id: result.procedureId! } });
      expect(proc.estimatedCostPaise).toBe(0);
    });
  });
});
