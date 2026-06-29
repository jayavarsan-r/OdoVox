import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, seedActivePlan } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('GET /plans/:id — detail', () => {
  it('returns the full nested structure: procedures → sittings, progress, prescriptions, xrayCount', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const { planId, procedureId } = await seedActivePlan(app, doc.clinicId, doc.userId, patientId, {
      procedure: 'RCT',
      teeth: [26],
      totalSittings: 4,
      completedSittings: 2,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/plans/${planId}`,
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const plan = res.json().data;

    expect(plan.status).toBe('ACTIVE');
    expect(plan.progress).toMatchObject({ totalSittings: 4, completedSittings: 2, percent: 50 });
    expect(plan.procedures).toHaveLength(1);
    expect(plan.procedures[0].id).toBe(procedureId);
    expect(plan.procedures[0].sittings).toHaveLength(2);
    expect(plan.procedures[0].sittings.map((s: { sittingNumber: number }) => s.sittingNumber)).toEqual([1, 2]);
    expect(plan.procedures[0].sittings.every((s: { completed: boolean }) => s.completed)).toBe(true);
    expect(plan.prescriptions).toEqual([]);
    expect(plan.xrayCount).toBe(0);
  });
});
