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

function continueData(planId: string, over: Record<string, unknown> = {}) {
  return {
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
    ...over,
  };
}

describe('multi-sitting confirm — continuation advances an existing plan', () => {
  it('adds the next sitting WITHOUT creating a new plan or procedure', async () => {
    const setup = await createDoctorWithClinic(app);
    const data = continueData('placeholder');
    const { consultationId, patientId } = await seedConsultation(app, setup.clinicId, setup.userId, data);
    const { planId, procedureId } = await seedActivePlan(app, setup.clinicId, setup.userId, patientId, {
      procedure: 'RCT',
      teeth: [26],
      totalSittings: 4,
      completedSittings: 2,
    });

    const result = await commitConsultation(app.prisma, {
      consultationId,
      structuredData: continueData(planId),
      userId: setup.userId,
      confirmedWithWarning: false,
    });

    expect(result.planId).toBe(planId);
    expect(result.procedureId).toBe(procedureId);

    await runWithContext({ clinicId: setup.clinicId, userId: setup.userId }, async () => {
      // Exactly one plan + one procedure — no orphan created.
      expect(await app.prisma.treatmentPlan.count({ where: { patientId } })).toBe(1);
      expect(await app.prisma.procedure.count({ where: { planId } })).toBe(1);

      const proc = await app.prisma.procedure.findUniqueOrThrow({ where: { id: procedureId } });
      expect(proc.completedSittings).toBe(3);
      expect(proc.status).toBe('IN_PROGRESS');

      const sittings = await app.prisma.sitting.findMany({
        where: { procedureId },
        orderBy: { sittingNumber: 'asc' },
      });
      expect(sittings.map((s) => s.sittingNumber)).toEqual([1, 2, 3]);
      expect(sittings[2]!.visitId).not.toBeNull();

      // Plan still active — not the final sitting.
      const plan = await app.prisma.treatmentPlan.findUniqueOrThrow({ where: { id: planId } });
      expect(plan.status).toBe('ACTIVE');
      expect(plan.completedAt).toBeNull();
    });
  });

  it('encrypts sitting clinical notes at rest (notesEnc, never plaintext)', async () => {
    const setup = await createDoctorWithClinic(app);
    const data = continueData('placeholder', { notes: 'Canal irrigation done, sensitivity reduced.' });
    const { consultationId, patientId } = await seedConsultation(app, setup.clinicId, setup.userId, data);
    const { planId, procedureId } = await seedActivePlan(app, setup.clinicId, setup.userId, patientId, {
      completedSittings: 2,
      totalSittings: 4,
    });

    await commitConsultation(app.prisma, {
      consultationId,
      structuredData: continueData(planId, { notes: 'Canal irrigation done, sensitivity reduced.' }),
      userId: setup.userId,
      confirmedWithWarning: false,
    });

    await runWithContext({ clinicId: setup.clinicId, userId: setup.userId }, async () => {
      const sitting = await app.prisma.sitting.findFirstOrThrow({
        where: { procedureId, sittingNumber: 3 },
      });
      expect(sitting.notesEnc).toBeTruthy();
      expect(sitting.notesEnc).not.toContain('irrigation');
    });
  });
});
