import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedActivePlan, seedConsultation } from './helpers.js';
import { commitConsultation } from '../src/lib/consultation/commit.js';

/**
 * Phase 9.6 Issue 10.1: "1st sitting panniaachu" showed as "0 of 1 sittings". Root cause: the
 * Sitting's completedAt was only set when the PROCEDURE status was COMPLETED — but a dictated
 * sitting is work performed TODAY. A multi-sitting RCT stays IN_PROGRESS overall, so its sittings
 * never counted. Rule: a dictated sitting counts as completed unless the work was ABORTED.
 */

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const base = {
  procedure: 'RCT',
  teeth: [36],
  sittingCurrent: 1,
  sittingTotal: 4,
  prescriptions: [],
  followUp: null,
  toothStatusUpdates: [],
  notes: null,
  clarifications: [],
  safetyWarnings: [],
};

describe('confirm inserts the sitting and updates the count', () => {
  it('a dictated sitting counts even when the procedure is IN_PROGRESS (1 of 4)', async () => {
    const setup = await createDoctorWithClinic(app);
    const data = { ...base, status: 'IN_PROGRESS' as const };
    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, data);

    const result = await commitConsultation(app.prisma, {
      consultationId,
      structuredData: data,
      userId: setup.userId,
      confirmedWithWarning: false,
    });

    const proc = await app.prisma.procedure.findUniqueOrThrow({ where: { id: result.procedureId! } });
    expect(proc.completedSittings).toBe(1); // was 0 — the reported bug
    expect(proc.status).toBe('IN_PROGRESS');

    const sitting = await app.prisma.sitting.findFirstOrThrow({ where: { procedureId: proc.id } });
    expect(sitting.sittingNumber).toBe(1);
    expect(sitting.completedAt).not.toBeNull();

    const plan = await app.prisma.treatmentPlan.findUniqueOrThrow({ where: { id: result.planId! } });
    expect(plan.status).toBe('ACTIVE'); // 1 of 4 — far from done
  });

  it('a dictated sitting with NO spoken status still counts (Tanglish default)', async () => {
    const setup = await createDoctorWithClinic(app);
    const data = { ...base, status: null };
    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, data);

    const result = await commitConsultation(app.prisma, {
      consultationId,
      structuredData: data,
      userId: setup.userId,
      confirmedWithWarning: false,
    });
    const proc = await app.prisma.procedure.findUniqueOrThrow({ where: { id: result.procedureId! } });
    expect(proc.completedSittings).toBe(1);
  });

  it('an ABORTED sitting does NOT count toward completion', async () => {
    const setup = await createDoctorWithClinic(app);
    const data = { ...base, status: 'ABORTED' as const };
    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, data);

    const result = await commitConsultation(app.prisma, {
      consultationId,
      structuredData: data,
      userId: setup.userId,
      confirmedWithWarning: false,
    });
    const proc = await app.prisma.procedure.findUniqueOrThrow({ where: { id: result.procedureId! } });
    expect(proc.completedSittings).toBe(0);
  });

  it('continuation branch: "2nd sitting done, in progress" advances 1→2 of 4', async () => {
    const setup = await createDoctorWithClinic(app);
    const seeded = await seedConsultation(app, setup.clinicId, setup.userId, {});
    const { planId } = await seedActivePlan(app, setup.clinicId, setup.userId, seeded.patientId, {
      procedure: 'RCT',
      teeth: [36],
      totalSittings: 4,
      completedSittings: 1,
    });
    const data = { ...base, continuesPlanId: planId, sittingCurrent: 2, status: 'IN_PROGRESS' as const };

    const result = await commitConsultation(app.prisma, {
      consultationId: seeded.consultationId,
      structuredData: data,
      userId: setup.userId,
      confirmedWithWarning: false,
    });

    const proc = await app.prisma.procedure.findUniqueOrThrow({ where: { id: result.procedureId! } });
    expect(proc.completedSittings).toBe(2);
    expect(proc.status).toBe('IN_PROGRESS');
  });
});
