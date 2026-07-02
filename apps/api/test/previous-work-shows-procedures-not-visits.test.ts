import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedConsultation, authHeader } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

/**
 * Regression (Phase 9.5 P1.3, Issue 6): the patient Overview's "Previous work" section rendered
 * VISITS (their chief-complaint text) as if they were completed work items. Previous work means
 * procedures actually completed — this endpoint feeds the section with exactly that: COMPLETED
 * procedures only, each with name + teeth + completion date. Pending procedures and empty visits
 * must never appear.
 */

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('GET /patients/:id/procedures — completed work only', () => {
  it('returns COMPLETED procedures with teeth + completion date, excluding pending ones', async () => {
    const setup = await createDoctorWithClinic(app);
    const { patientId } = await seedConsultation(app, setup.clinicId, setup.userId, {});

    const completedAt = new Date('2026-06-20T10:00:00Z');
    await runWithContext({ clinicId: setup.clinicId, userId: setup.userId }, async () => {
      await app.prisma.treatmentPlan.create({
        data: {
          patientId,
          name: 'Root canal 26',
          status: 'ACTIVE',
          createdById: setup.userId,
          procedures: {
            create: [
              {
                name: 'RCT',
                toothNumbers: [26],
                totalSittings: 1,
                completedSittings: 1,
                status: 'COMPLETED',
                sittings: { create: [{ sittingNumber: 1, completedAt }] },
              },
              { name: 'Crown', toothNumbers: [26], totalSittings: 1, status: 'PENDING' },
            ],
          },
        },
      });
    });

    const res = await app.inject({
      method: 'GET',
      url: `/patients/${patientId}/procedures`,
      headers: authHeader(setup.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().data as Array<{
      id: string;
      name: string;
      toothNumbers: number[];
      completedAt: string;
    }>;

    expect(items).toHaveLength(1); // the PENDING Crown must not appear
    expect(items[0]).toMatchObject({ name: 'RCT', toothNumbers: [26] });
    expect(new Date(items[0]!.completedAt).toISOString()).toBe(completedAt.toISOString());
  });

  it('returns an empty list when nothing is completed yet (visits alone are not "work")', async () => {
    const setup = await createDoctorWithClinic(app);
    // seedConsultation creates a visit — but no completed procedure.
    const { patientId } = await seedConsultation(app, setup.clinicId, setup.userId, {});

    const res = await app.inject({
      method: 'GET',
      url: `/patients/${patientId}/procedures`,
      headers: authHeader(setup.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });
});
