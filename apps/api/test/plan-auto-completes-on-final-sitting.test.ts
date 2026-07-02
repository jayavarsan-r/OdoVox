import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedConsultation } from './helpers.js';
import { commitConsultation } from '../src/lib/consultation/commit.js';

/**
 * Regression (Phase 9.5 P1.4, Issue 8): confirming the final sitting of a NEW plan (the voice
 * path: "Filling on 46, done today" → plan+procedure created in the same confirm) completed the
 * PROCEDURE but left the PLAN stuck ACTIVE — the doctor had to close it manually, and the Cases
 * tab kept an empty "active" case forever. The multi-sitting branch already completed the plan;
 * the new-plan branch must too (when no other procedure on the plan remains open).
 */

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const oneSittingFilling = {
  procedure: 'Filling',
  teeth: [46],
  sittingCurrent: 1,
  sittingTotal: 1,
  status: 'COMPLETED' as const,
  prescriptions: [],
  followUp: null,
  toothStatusUpdates: [],
  notes: null,
  clarifications: [],
  safetyWarnings: [],
};

describe('new-plan confirm — final sitting auto-completes the plan', () => {
  it('1/1 sitting COMPLETED → procedure AND plan end up COMPLETED with completedAt', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId, patientId } = await seedConsultation(app, setup.clinicId, setup.userId, oneSittingFilling);

    await commitConsultation(app.prisma, {
      consultationId,
      structuredData: oneSittingFilling,
      userId: setup.userId,
      confirmedWithWarning: false,
    });

    const plan = await app.prisma.treatmentPlan.findFirstOrThrow({ where: { patientId, name: 'Filling' } });
    const procedure = await app.prisma.procedure.findFirstOrThrow({ where: { planId: plan.id } });
    expect(procedure.status).toBe('COMPLETED');
    expect(procedure.completedSittings).toBe(1);
    expect(plan.status).toBe('COMPLETED');
    expect(plan.completedAt).not.toBeNull();
  });

  it('an unfinished sitting (1 of 2) keeps both procedure and plan open', async () => {
    const setup = await createDoctorWithClinic(app);
    const partial = { ...oneSittingFilling, procedure: 'RCT', sittingTotal: 2 };
    const { consultationId, patientId } = await seedConsultation(app, setup.clinicId, setup.userId, partial);

    await commitConsultation(app.prisma, {
      consultationId,
      structuredData: partial,
      userId: setup.userId,
      confirmedWithWarning: false,
    });

    const plan = await app.prisma.treatmentPlan.findFirstOrThrow({ where: { patientId, name: 'RCT' } });
    const procedure = await app.prisma.procedure.findFirstOrThrow({ where: { planId: plan.id } });
    expect(procedure.status).toBe('IN_PROGRESS');
    expect(plan.status).toBe('ACTIVE');
    expect(plan.completedAt).toBeNull();
  });
});
