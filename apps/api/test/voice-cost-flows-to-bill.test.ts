import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, joinReceptionist, seedConsultation } from './helpers.js';
import { commitConsultation } from '../src/lib/consultation/commit.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const data = {
  procedure: 'RCT', teeth: [26], sittingCurrent: 1, sittingTotal: 1, continuesPlanId: null,
  status: 'COMPLETED' as const, estimatedCostPaise: 500000, prescriptions: [], followUp: null,
  toothStatusUpdates: [], notes: null, clarifications: [], safetyWarnings: [],
};

describe('Voice cost flows to the bill', () => {
  it('the auto-populated PROCEDURE line uses the dictated estimated cost', async () => {
    const s = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, s.joinCode);
    const { consultationId, patientId, visitId } = await seedConsultation(app, s.clinicId, s.userId, data);
    await commitConsultation(app.prisma, { consultationId, structuredData: data, userId: s.userId, confirmedWithWarning: false });

    const res = await app.inject({
      method: 'POST', url: '/bills', headers: authHeader(recp.accessToken),
      payload: { patientId, visitId },
    });
    expect(res.statusCode).toBe(201);
    const proc = res.json().data.items.find((i: { kind: string }) => i.kind === 'PROCEDURE');
    expect(proc).toBeTruthy();
    expect(proc.unitPricePaise).toBe(500000);
    expect(res.json().data.totalPaise).toBe(500000);
  });
});
