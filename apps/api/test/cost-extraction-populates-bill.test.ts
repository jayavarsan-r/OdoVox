import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedConsultation } from './helpers.js';
import { commitConsultation } from '../src/lib/consultation/commit.js';
import { buildItemsFromVisit } from '../src/lib/billing/auto-populate.js';
import { runWithContext } from '../src/lib/request-context.js';

/**
 * Phase 9.6 Issue 8 (cost leg): "fees 5000 collect" must flow dictation → extraction
 * (estimatedCostPaise) → Procedure.estimatedCostPaise on confirm → the visit's draft bill item —
 * so checkout shows ₹5,000 due without the receptionist re-typing it.
 */

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const dictated = {
  procedure: 'RCT',
  teeth: [36],
  sittingCurrent: 1,
  sittingTotal: 4,
  status: 'COMPLETED' as const,
  estimatedCostPaise: 500_000,
  prescriptions: [],
  followUp: null,
  toothStatusUpdates: [],
  notes: null,
  clarifications: [],
  safetyWarnings: [],
};

describe('dictated cost flows to the bill', () => {
  it('confirm stores the cost on the procedure and the visit bill item carries it', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId, visitId, patientId } = await seedConsultation(
      app,
      setup.clinicId,
      setup.userId,
      dictated,
    );

    const result = await commitConsultation(app.prisma, {
      consultationId,
      structuredData: dictated,
      userId: setup.userId,
      confirmedWithWarning: false,
    });
    expect(result.procedureId).toBeTruthy();

    const procedure = await app.prisma.procedure.findUniqueOrThrow({ where: { id: result.procedureId! } });
    expect(procedure.estimatedCostPaise).toBe(500_000);

    // LabCase/inventory reads inside are clinic-scoped — run in the clinic's context.
    const items = await runWithContext({ clinicId: setup.clinicId, userId: setup.userId }, async () =>
      buildItemsFromVisit(app.prisma, {
        clinicId: setup.clinicId,
        visitId,
        chargeForMaterials: false,
      }),
    );
    const procItem = items.find((i) => i.kind === 'PROCEDURE');
    expect(procItem).toBeTruthy();
    expect(procItem!.unitPricePaise).toBe(500_000);
    expect(procItem!.description).toContain('RCT');
    expect(patientId).toBeTruthy();
  });
});
