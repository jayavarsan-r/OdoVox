import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, seedActivePlan } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('POST /plans/:id/cancel', () => {
  it('cancels the plan + all sub-procedures with a reason, and audits it', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const { planId, procedureId } = await seedActivePlan(app, doc.clinicId, doc.userId, patientId, {
      completedSittings: 1,
      totalSittings: 4,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/plans/${planId}/cancel`,
      headers: authHeader(doc.accessToken),
      payload: { reason: 'Patient moved cities' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('CANCELLED');

    await runWithContext({ clinicId: doc.clinicId, userId: doc.userId }, async () => {
      const plan = await app.prisma.treatmentPlan.findUniqueOrThrow({ where: { id: planId } });
      expect(plan.status).toBe('CANCELLED');
      expect(plan.cancelledAt).not.toBeNull();
      expect(plan.cancellationReason).toBe('Patient moved cities');

      const proc = await app.prisma.procedure.findUniqueOrThrow({ where: { id: procedureId } });
      expect(proc.status).toBe('CANCELLED');
    });

    const audit = await app.prisma.auditLog.findFirst({
      where: { action: 'TREATMENT_PLAN_CANCELLED', entityId: planId },
    });
    expect(audit).toBeTruthy();
  });

  it('rejects an empty reason (400 validation)', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const { planId } = await seedActivePlan(app, doc.clinicId, doc.userId, patientId);
    const res = await app.inject({
      method: 'POST',
      url: `/plans/${planId}/cancel`,
      headers: authHeader(doc.accessToken),
      payload: { reason: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});
